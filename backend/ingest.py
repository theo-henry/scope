import json
import re
from hashlib import sha1
from datetime import datetime, timezone

import feedparser
from google.cloud import storage


BUCKET_NAME = "scope-news-raw-data"
# Per-feed cap. With the feed set below this yields ~80-120 documents, enough for
# Discovery Engine to return 5-8 outlet clusters per synthesize.py TOPIC.
PER_FEED_LIMIT = 12

# Multi-source feed set chosen to cover synthesize.py's TOPICS (Finance, Markets,
# Politics, Tech/AI, World). Each entry: (source display name, RSS url).
FEEDS = [
    ("BBC Business",         "http://feeds.bbci.co.uk/news/business/rss.xml"),
    ("BBC Technology",       "http://feeds.bbci.co.uk/news/technology/rss.xml"),
    ("BBC Politics",         "http://feeds.bbci.co.uk/news/politics/rss.xml"),
    ("BBC World News",       "http://feeds.bbci.co.uk/news/world/rss.xml"),
    ("CNBC",                 "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
    ("CNBC Finance",         "https://www.cnbc.com/id/10000664/device/rss/rss.html"),
    ("The Guardian Business",   "https://www.theguardian.com/business/rss"),
    ("The Guardian Technology", "https://www.theguardian.com/technology/rss"),
    ("The Guardian US Politics","https://www.theguardian.com/us-news/us-politics/rss"),
    ("The Guardian World",      "https://www.theguardian.com/world/rss"),
]

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def build_article_id(link):
    # Generic, source-agnostic id keyed on the canonical link. Stable across runs
    # so re-ingestion upserts rather than duplicates in Discovery Engine.
    digest = sha1(link.encode("utf-8")).hexdigest()[:16]
    return f"art-{digest}"


def clean_summary(raw):
    # Guardian/CNBC summaries carry HTML; strip tags so the synthesis prompt and
    # the frontend receive plain text (BBC was already clean).
    return _WS_RE.sub(" ", _TAG_RE.sub("", raw or "")).strip()


def fetch_feed(source_name, url, ingested_at):
    feed = feedparser.parse(url)
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
                "ingested_at": ingested_at,
            }
        )
    return articles


def fetch_articles():
    ingested_at = datetime.now(timezone.utc).isoformat()
    seen = set()
    articles = []
    for source_name, url in FEEDS:
        feed_articles = fetch_feed(source_name, url, ingested_at)
        for article in feed_articles:
            if article["id"] in seen:
                continue
            seen.add(article["id"])
            articles.append(article)
        print(f"  {source_name}: {len(feed_articles)} fetched")
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
