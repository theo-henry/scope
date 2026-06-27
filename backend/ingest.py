import json
from hashlib import sha1
from datetime import datetime, timezone

import feedparser
from google.cloud import storage


RSS_FEED_URL = "http://feeds.bbci.co.uk/news/world/rss.xml"
BUCKET_NAME = "scope-news-raw-data"
SOURCE_NAME = "BBC World News"
ARTICLE_LIMIT = 10


def build_article_id(link):
    digest = sha1(link.encode("utf-8")).hexdigest()[:16]
    return f"bbc-{digest}"


def fetch_articles():
    feed = feedparser.parse(RSS_FEED_URL)
    ingested_at = datetime.now(timezone.utc).isoformat()

    articles = []
    for entry in feed.entries[:ARTICLE_LIMIT]:
        link = entry.get("link", "")
        articles.append(
            {
                "id": build_article_id(link),
                "title": entry.get("title", ""),
                "link": link,
                "summary": entry.get("summary", ""),
                "published_date": entry.get("published", ""),
                "source": SOURCE_NAME,
                "ingested_at": ingested_at,
            }
        )

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
        filename=f"raw/bbc_world_{timestamp}.json",
        body=json.dumps(articles, indent=2, ensure_ascii=False),
        content_type="application/json",
    )

    ndjson_body = "\n".join(json.dumps(article, ensure_ascii=False) for article in articles)
    ndjson_uri = upload_text_to_gcs(
        client=client,
        filename=f"agent-search/bbc_world_{timestamp}.ndjson",
        body=f"{ndjson_body}\n",
        content_type="application/x-ndjson",
    )

    return raw_json_uri, ndjson_uri


def main():
    articles = fetch_articles()

    if not articles:
        raise RuntimeError(f"No articles were fetched from {RSS_FEED_URL}")

    raw_json_uri, ndjson_uri = upload_articles_to_gcs(articles)
    print(f"Uploaded {len(articles)} raw articles to {raw_json_uri}")
    print(f"Uploaded {len(articles)} Agent Search documents to {ndjson_uri}")


if __name__ == "__main__":
    main()
