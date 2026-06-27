import json
import os
import re
from hashlib import sha1
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse

import feedparser
from google.cloud import storage


BUCKET_NAME = os.environ.get("SCOPE_BUCKET_NAME", "scope-news-raw-data")
# Per-feed cap. With the feed set below this yields ~80-120 documents, enough for
# Discovery Engine to return 5-8 outlet clusters per synthesize.py TOPIC.
PER_FEED_LIMIT = int(os.environ.get("SCOPE_PER_FEED_LIMIT", "12"))
SOURCE_CATALOG = os.environ.get(
    "SCOPE_SOURCE_CATALOG",
    str(Path(__file__).resolve().parent / "sources.json"),
)

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def canonical_url(url):
    parsed = urlparse(url or "")
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path.rstrip("/")
    return f"{host}{path}" if host or path else (url or "").strip()


def build_article_id(link):
    # Generic, source-agnostic id keyed on the canonical link. Stable across runs
    # so re-ingestion upserts rather than duplicates in Discovery Engine.
    digest = sha1(canonical_url(link).encode("utf-8")).hexdigest()[:16]
    return f"art-{digest}"


def clean_summary(raw):
    # Guardian/CNBC summaries carry HTML; strip tags so the synthesis prompt and
    # the frontend receive plain text (BBC was already clean).
    return _WS_RE.sub(" ", _TAG_RE.sub("", raw or "")).strip()


def load_sources(path=SOURCE_CATALOG):
    with open(path, encoding="utf-8") as f:
        sources = json.load(f)
    if not isinstance(sources, list):
        raise ValueError(f"Source catalog must be a list: {path}")

    validated = []
    for index, source in enumerate(sources, start=1):
        if not source.get("enabled", True):
            continue
        for key in ["name", "url", "category", "country", "tier"]:
            if key not in source:
                raise ValueError(f"Source #{index} missing required key: {key}")
        validated.append(source)
    return validated


def fetch_feed(source, ingested_at):
    source_name = source["name"]
    feed = feedparser.parse(source["url"])
    articles = []
    for entry in feed.entries[:PER_FEED_LIMIT]:
        link = entry.get("link", "")
        if not link:
            continue
        articles.append(
            {
                "id": build_article_id(link),
                "title": entry.get("title", ""),
                "link": link,
                "summary": clean_summary(entry.get("summary", "")),
                "published_date": entry.get("published", ""),
                "source": source_name,
                "source_category": source["category"],
                "source_country": source["country"],
                "source_tier": source["tier"],
                "ingested_at": ingested_at,
            }
        )
    return articles


def fetch_articles_with_report():
    ingested_at = datetime.now(timezone.utc).isoformat()
    seen = set()
    articles = []
    source_stats = []
    sources = load_sources()
    for source in sources:
        try:
            feed_articles = fetch_feed(source, ingested_at)
            error = ""
        except Exception as exc:
            feed_articles = []
            error = str(exc)

        accepted = 0
        for article in feed_articles:
            if article["id"] in seen:
                continue
            seen.add(article["id"])
            articles.append(article)
            accepted += 1

        source_stats.append(
            {
                "source": source["name"],
                "url": source["url"],
                "category": source["category"],
                "country": source["country"],
                "tier": source["tier"],
                "fetched": len(feed_articles),
                "accepted": accepted,
                "error": error,
            }
        )
        suffix = f" ({error})" if error else ""
        print(f"  {source['name']}: {len(feed_articles)} fetched, {accepted} accepted{suffix}")
    return articles, source_stats


def fetch_articles():
    articles, _source_stats = fetch_articles_with_report()
    return articles


def upload_text_to_gcs(client, filename, body, content_type):
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(filename)
    blob.upload_from_string(body, content_type=content_type)

    return f"gs://{BUCKET_NAME}/{filename}"


def upload_articles_to_gcs(articles):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    client = storage.Client()

    raw_json_uri = upload_text_to_gcs(
        client=client,
        filename=f"raw/scope_news_{timestamp}.json",
        body=json.dumps(articles, indent=2, ensure_ascii=False),
        content_type="application/json",
    )

    ndjson_body = "\n".join(json.dumps(article, ensure_ascii=False) for article in articles)
    ndjson_uri = upload_text_to_gcs(
        client=client,
        filename=f"agent-search/scope_news_{timestamp}.ndjson",
        body=f"{ndjson_body}\n",
        content_type="application/x-ndjson",
    )

    return raw_json_uri, ndjson_uri


def main():
    articles = fetch_articles()

    if not articles:
        raise RuntimeError("No articles were fetched from any configured feed.")

    raw_json_uri, ndjson_uri = upload_articles_to_gcs(articles)
    print(f"Uploaded {len(articles)} raw articles to {raw_json_uri}")
    print(f"Uploaded {len(articles)} Agent Search documents to {ndjson_uri}")


if __name__ == "__main__":
    main()
