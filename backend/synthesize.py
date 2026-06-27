"""Tri-Perspective Lens synthesis for Scope.

Pipeline position (PRD §4):
    Discovery Engine retrieval  ->  THIS SCRIPT (Gemini 1.5 Flash)  ->  cached JSON

For each topic cluster it:
  1. Retrieves the covering articles from Discovery Engine / Agent Search.
  2. Asks Gemini 1.5 Flash (on Vertex AI) to synthesize the three explicit lenses,
     enforced by a structured `response_schema` so the JSON cannot break the
     frontend contract (scope-news-reader/lib/types.ts: Story / TriPerspectiveLens).
  3. Assembles the full Story object (metadata + grounded source list come from the
     retrieved docs, NOT from the model) and uploads it to the synthesized cache.

PREREQUISITES (do NOT run before these hold):
  - Discovery Engine retrieval is verified (see backend/search_test.py).
  - Gemini auth is available, EITHER:
      * GEMINI_API_KEY / GOOGLE_API_KEY set (Gemini Developer API), OR
      * Vertex AI enabled + ADC configured for `scope-mvp-prod`.
  - SCOPE_DATA_STORE_ID / SCOPE_SEARCH_ENGINE_ID are exported (see CLAUDE.md).

Run (Gemini Developer API key path, as used in Cloud Shell):
    export GEMINI_API_KEY="..."
    export SCOPE_DATA_STORE_ID="scope-news-raw-datastore"
    export SCOPE_SEARCH_ENGINE_ID="scope-news-search"
    python backend/synthesize.py
"""

import json
import os
import re
from hashlib import sha1
from pathlib import Path
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from google import genai
from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine, storage
from google.genai import types


def load_local_env_file():
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_local_env_file()


PROJECT_ID = os.environ.get("SCOPE_PROJECT_ID", "scope-mvp-prod")
LOCATION = os.environ.get("DISCOVERY_ENGINE_LOCATION", "global")
# Gemini on Vertex uses a regional (or "global") endpoint, distinct from the
# Discovery Engine location above.
VERTEX_LOCATION = os.environ.get("SCOPE_VERTEX_LOCATION", "global")
DATA_STORE_ID = os.environ.get("SCOPE_DATA_STORE_ID", "")
SEARCH_ENGINE_ID = os.environ.get("SCOPE_SEARCH_ENGINE_ID", "")
BUCKET_NAME = os.environ.get("SCOPE_BUCKET_NAME", "scope-news-raw-data")
# PRD targets "Gemini 1.5 Flash", but 1.5 is not served on the current Gemini
# Developer API; 2.5 Flash is confirmed working with the project key. Override
# with SCOPE_GEMINI_MODEL if needed.
MODEL = os.environ.get("SCOPE_GEMINI_MODEL", "gemini-2.5-flash")
IMAGE_MODEL = os.environ.get("SCOPE_GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")
IMAGE_ASPECT_RATIO = "16:9"
IMAGE_WIDTH = 2048
IMAGE_HEIGHT = 1152
IMAGE_MIME_TYPE = "image/jpeg"
IMAGE_PREFIX = os.environ.get("SCOPE_IMAGE_PREFIX", "story-images")
STORY_RETENTION_DAYS = int(os.environ.get("SCOPE_STORY_RETENTION_DAYS", "14"))
MAX_STORIES = int(os.environ.get("SCOPE_MAX_STORIES", "50"))
CLUSTER_DOC_MAX_AGE_DAYS = int(
    os.environ.get("SCOPE_CLUSTER_DOC_MAX_AGE_DAYS", str(STORY_RETENTION_DAYS))
)
MIN_DOMAINS = int(os.environ.get("SCOPE_MIN_DOMAINS", "3"))
EXCEPTION_MIN_DOMAINS = int(os.environ.get("SCOPE_EXCEPTION_MIN_DOMAINS", "2"))
MIN_DOMAINS_EXCEPTION_CATEGORIES = {
    category.strip()
    for category in os.environ.get(
        "SCOPE_MIN_DOMAINS_EXCEPTION_CATEGORIES", "Tech/AI,Markets"
    ).split(",")
    if category.strip()
}
MAX_NEW_CLUSTERS = int(os.environ.get("SCOPE_MAX_NEW_CLUSTERS", "10"))
MAX_DOMAIN_SHARE = float(os.environ.get("SCOPE_MAX_DOMAIN_SHARE", "0.6"))
# Auth path for Gemini. If a key is set (Gemini Developer API / AI Studio), use it;
# otherwise fall back to Vertex AI via ADC. Both go through the google-genai SDK.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
GEMINI_SECRET_ID = os.environ.get("SCOPE_GEMINI_SECRET_ID", "")

CLUSTER_SIZE = 8  # PRD: 5-8 outlets per story.

# Candidate queries are intentionally short because Discovery Engine's relevance
# filter on this small corpus is strict. Each viable candidate may become one
# story cluster after quality gates and sourceKey dedupe.
CANDIDATE_TOPICS = [
    {"query": "central bank interest rates", "category": "Finance", "country": "Global"},
    {"query": "inflation interest rates", "category": "Finance", "country": "Global"},
    {"query": "government debt bonds", "category": "Finance", "country": "Global"},
    {"query": "banking regulation", "category": "Finance", "country": "Global"},
    {"query": "stock market earnings", "category": "Markets", "country": "United States"},
    {"query": "AI stocks valuation", "category": "Markets", "country": "United States"},
    {"query": "oil prices markets", "category": "Markets", "country": "Global"},
    {"query": "company earnings outlook", "category": "Markets", "country": "United States"},
    {"query": "tax", "category": "Politics", "country": "United States"},
    {"query": "government budget", "category": "Politics", "country": "United States"},
    {"query": "election campaign", "category": "Politics", "country": "United States"},
    {"query": "immigration policy", "category": "Politics", "country": "United States"},
    {"query": "artificial intelligence regulation", "category": "Tech/AI", "country": "Global"},
    {"query": "OpenAI AI model", "category": "Tech/AI", "country": "Global"},
    {"query": "data privacy technology", "category": "Tech/AI", "country": "Global"},
    {"query": "semiconductor chips", "category": "Tech/AI", "country": "Global"},
    {"query": "trade war", "category": "World", "country": "Global"},
    {"query": "Middle East ceasefire", "category": "World", "country": "Global"},
    {"query": "Ukraine Russia", "category": "World", "country": "Global"},
    {"query": "European Union tariffs", "category": "World", "country": "Global"},
    {"query": "China trade", "category": "World", "country": "Global"},
]

SYSTEM_INSTRUCTION = (
    "You are Scope's grounded news synthesizer. You are given the full text of "
    "several news articles covering one real-world event. Produce exactly three "
    "analytical lenses. You may ONLY use facts present in the provided articles; "
    "never invent details. If a lens has insufficient material, keep it brief and "
    "say so rather than speculating.\n\n"
    "Lens 1 (Institutional / Neutral Synthesis): the consensus account drawn from "
    "official statements, government/regulatory action, and established analysis.\n"
    "Lens 2 (Reformist / Divergence): market disruption, public/labor reaction, and "
    "alternative interpretations; list the points all sources agree on and the "
    "points they diverge on.\n"
    "Lens 3 (Skeptic / Bias & Validity): speculative claims, missing data, and "
    "narrative skew; set validityScore (0-100) from how many independent outlets "
    "corroborate the core facts, and justify it in validityRationale."
)

# Structured-output schema. Mirrors TriPerspectiveLens in the frontend types so
# the cached JSON is consumable without transformation.
LENS_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "aiSummary": {"type": "string"},
        "lenses": {
            "type": "object",
            "properties": {
                "institutional": {
                    "type": "object",
                    "properties": {"synthesis": {"type": "string"}},
                    "required": ["synthesis"],
                },
                "reformist": {
                    "type": "object",
                    "properties": {
                        "summary": {"type": "string"},
                        "agreements": {"type": "array", "items": {"type": "string"}},
                        "divergences": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["summary", "agreements", "divergences"],
                },
                "skeptic": {
                    "type": "object",
                    "properties": {
                        "summary": {"type": "string"},
                        "validityScore": {"type": "integer"},
                        "validityRationale": {"type": "string"},
                        "missingNote": {"type": "string"},
                    },
                    "required": ["summary", "validityScore", "validityRationale"],
                },
            },
            "required": ["institutional", "reformist", "skeptic"],
        },
    },
    "required": ["headline", "aiSummary", "lenses"],
}


def read_secret_value(secret_id):
    from google.cloud import secretmanager

    if "/" in secret_id:
        name = secret_id
    else:
        name = f"projects/{PROJECT_ID}/secrets/{secret_id}/versions/latest"
    response = secretmanager.SecretManagerServiceClient().access_secret_version(
        request={"name": name}
    )
    return response.payload.data.decode("utf-8").strip()


def get_gemini_api_key():
    if GEMINI_API_KEY:
        return GEMINI_API_KEY
    if GEMINI_SECRET_ID:
        return read_secret_value(GEMINI_SECRET_ID)
    return ""


def build_genai_client():
    # Gemini Developer API key (what was used in Cloud Shell) takes precedence;
    # otherwise authenticate to Vertex AI through ADC.
    api_key = get_gemini_api_key()
    if api_key:
        return genai.Client(api_key=api_key)
    return genai.Client(vertexai=True, project=PROJECT_ID, location=VERTEX_LOCATION)


def build_search_client():
    api_endpoint = (
        "discoveryengine.googleapis.com"
        if LOCATION == "global"
        else f"{LOCATION}-discoveryengine.googleapis.com"
    )
    return discoveryengine.SearchServiceClient(
        client_options=ClientOptions(api_endpoint=api_endpoint)
    )


def serving_config():
    if SEARCH_ENGINE_ID:
        return (
            f"projects/{PROJECT_ID}/locations/{LOCATION}/collections/default_collection"
            f"/engines/{SEARCH_ENGINE_ID}/servingConfigs/default_config"
        )
    return (
        f"projects/{PROJECT_ID}/locations/{LOCATION}/collections/default_collection"
        f"/dataStores/{DATA_STORE_ID}/servingConfigs/default_config"
    )


def retrieve_cluster(client, query):
    request = discoveryengine.SearchRequest(
        serving_config=serving_config(), query=query, page_size=CLUSTER_SIZE
    )
    docs = []
    for result in client.search(request).results:
        data = dict(result.document.struct_data)
        docs.append(
            {
                "title": data.get("title", ""),
                "link": data.get("link", ""),
                "summary": (data.get("summary", "") or "").strip(),
                "source": data.get("source", ""),
                "source_tier": int(data.get("source_tier", 3) or 3),
                "source_category": data.get("source_category", ""),
                "source_country": data.get("source_country", ""),
                "published_date": data.get("published_date", ""),
                "ingested_at": data.get("ingested_at", ""),
            }
        )
    return docs


def canonical_url(url):
    parsed = urlparse(url or "")
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path.rstrip("/")
    return f"{host}{path}" if host or path else (url or "").strip()


def cluster_source_key(topic, docs):
    urls = sorted(
        canonical_url(doc.get("link", ""))
        for doc in docs
        if canonical_url(doc.get("link", ""))
    )
    if not urls:
        titles = sorted((doc.get("title", "") or "").strip().lower() for doc in docs)
        urls = [title for title in titles if title]
    raw = json.dumps(
        {
            "topic": topic["query"],
            "category": topic["category"],
            "country": topic["country"],
            "sources": urls,
        },
        sort_keys=True,
    )
    return f"src_{sha1(raw.encode('utf-8')).hexdigest()[:16]}"


def parse_iso_datetime(raw):
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def filter_recent_docs(docs):
    cutoff = datetime.now(timezone.utc) - timedelta(days=CLUSTER_DOC_MAX_AGE_DAYS)
    recent = []
    for doc in docs:
        timestamp = parse_iso_datetime(doc.get("ingested_at", ""))
        if timestamp and timestamp >= cutoff:
            recent.append(doc)
    return recent


def slugify(text):
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:60] or "story"


def domain_of(url):
    host = urlparse(url).netloc
    return host[4:] if host.startswith("www.") else host


def dedupe_docs_by_domain(docs):
    by_domain = {}
    for doc in docs:
        domain = domain_of(doc.get("link", ""))
        if not domain:
            continue
        existing = by_domain.get(domain)
        if not existing or int(doc.get("source_tier", 3)) < int(existing.get("source_tier", 3)):
            by_domain[domain] = doc
    return list(by_domain.values())


def cluster_stats(topic, raw_docs, recent_docs, docs):
    domains = sorted({domain_of(doc.get("link", "")) for doc in docs if doc.get("link")})
    recent_domains = [
        domain_of(doc.get("link", "")) for doc in recent_docs if doc.get("link")
    ]
    top_domain_share = 0
    if recent_domains:
        top_domain_share = max(recent_domains.count(domain) for domain in set(recent_domains)) / len(
            recent_domains
        )
    tiers = [int(doc.get("source_tier", 3) or 3) for doc in docs]
    timestamps = [
        timestamp
        for timestamp in (parse_iso_datetime(doc.get("ingested_at", "")) for doc in docs)
        if timestamp
    ]
    latest_ingested_at = max(timestamps, default=None)
    return {
        "query": topic["query"],
        "category": topic["category"],
        "country": topic["country"],
        "raw_docs": len(raw_docs),
        "recent_docs": len(recent_docs),
        "deduped_docs": len(docs),
        "domain_count": len(domains),
        "domains": domains,
        "top_domain_share": round(top_domain_share, 3),
        "tier_sum": sum(tiers),
        "latest_ingested_at": latest_ingested_at.isoformat() if latest_ingested_at else "",
    }


def required_domain_count(category):
    if category in MIN_DOMAINS_EXCEPTION_CATEGORIES:
        return EXCEPTION_MIN_DOMAINS
    return MIN_DOMAINS


def quality_skip_reason(topic, stats):
    required_domains = required_domain_count(topic["category"])
    if stats["recent_docs"] == 0:
        return f"no recent documents within {CLUSTER_DOC_MAX_AGE_DAYS} days"
    if stats["domain_count"] < required_domains:
        return (
            f"only {stats['domain_count']} distinct domains; "
            f"requires {required_domains}"
        )
    if stats["deduped_docs"] < required_domains:
        return (
            f"only {stats['deduped_docs']} deduped documents; "
            f"requires {required_domains}"
        )
    if stats["top_domain_share"] > MAX_DOMAIN_SHARE:
        return (
            f"top domain share {stats['top_domain_share']:.0%}; "
            f"max allowed {MAX_DOMAIN_SHARE:.0%}"
        )
    return ""


def cluster_rank(cluster):
    stats = cluster["stats"]
    latest = parse_iso_datetime(stats.get("latest_ingested_at"))
    recency = latest.timestamp() if latest else 0
    return (
        stats["domain_count"],
        -stats["tier_sum"],
        stats["deduped_docs"],
        recency,
    )


def cluster_to_sources(docs):
    # The source list is grounded in the retrieved docs, not generated. Bias
    # lean / reliability come from a curated outlet dataset later (deferred);
    # default to neutral placeholders so the frontend contract is satisfied.
    sources = []
    for doc in docs:
        sources.append(
            {
                "outlet": doc["source"] or domain_of(doc["link"]),
                "domain": domain_of(doc["link"]),
                "biasLean": "center",
                "reliability": 75,
                "articleTitle": doc["title"],
                "url": doc["link"],
            }
        )
    return sources


def build_prompt(docs):
    blocks = []
    for index, doc in enumerate(docs, start=1):
        blocks.append(
            f"ARTICLE {index} — {doc['source']}\n"
            f"Title: {doc['title']}\n"
            f"Body: {doc['summary']}"
        )
    return "Articles covering one event:\n\n" + "\n\n".join(blocks)


def synthesize_lenses(genai_client, docs):
    response = genai_client.models.generate_content(
        model=MODEL,
        contents=build_prompt(docs),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.2,
            response_mime_type="application/json",
            response_schema=LENS_RESPONSE_SCHEMA,
        ),
    )
    return json.loads(response.text)


def build_image_prompt(story, docs):
    source_titles = "; ".join(doc["title"] for doc in docs[:5] if doc.get("title"))
    return (
        "Create one realistic editorial news image for a modern news website.\n"
        "Use a consistent Scope visual style across all stories: simple realistic "
        "composition, restrained color, natural cinematic light, documentary "
        "photography feel, shallow but not distracting depth of field, clean negative "
        "space suitable for a headline overlay, no collage, no illustration, no "
        "cartoon style.\n\n"
        "Strict requirements: no visible words, no readable text, no letters, no "
        "logos, no watermarks, no UI, no charts with labels, no newspaper front "
        "pages, no fabricated documents, no sensational disaster imagery. Do not "
        "recreate a real news photo. Avoid recognizable public-figure likenesses "
        "unless absolutely necessary; prefer symbolic real-world scenes, objects, "
        "institutions, environments, markets, technology, or civic settings.\n\n"
        f"Story category: {story['category']}\n"
        f"Story country: {story['country']}\n"
        f"Headline: {story['headline']}\n"
        f"Summary: {story['aiSummary']}\n"
        f"Source article titles: {source_titles}\n\n"
        "Decide the best simple visual metaphor for the story's general theme and "
        "generate a realistic 16:9 image. Leave darker or calmer space toward the "
        "left/center so white headline text can remain readable when used as a "
        "header background."
    )


def public_gcs_url(blob_name):
    return f"https://storage.googleapis.com/{BUCKET_NAME}/{blob_name}"


def extension_for_mime_type(mime_type):
    if mime_type == "image/png":
        return "png"
    if mime_type == "image/webp":
        return "webp"
    return "jpg"


def image_blob_name(story, mime_type, prompt):
    prompt_hash = sha1(prompt.encode("utf-8")).hexdigest()[:12]
    ext = extension_for_mime_type(mime_type)
    return f"{IMAGE_PREFIX}/{story['id']}/{prompt_hash}.{ext}"


def upload_story_image(storage_client, blob_name, image_bytes, mime_type):
    blob = storage_client.bucket(BUCKET_NAME).blob(blob_name)
    blob.cache_control = "public, max-age=31536000, immutable"
    blob.upload_from_string(image_bytes, content_type=mime_type)
    return f"gs://{BUCKET_NAME}/{blob_name}", public_gcs_url(blob_name)


def story_image_metadata(story, prompt, mime_type, gcs_uri, url):
    return {
        "url": url,
        "gcsUri": gcs_uri,
        "alt": f"Generated editorial image for: {story['headline']}",
        "prompt": prompt,
        "width": IMAGE_WIDTH,
        "height": IMAGE_HEIGHT,
        "mimeType": mime_type,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


def generated_image_from_bytes(storage_client, story, prompt, image_bytes, mime_type):
    blob_name = image_blob_name(story, mime_type, prompt)
    gcs_uri, url = upload_story_image(
        storage_client=storage_client,
        blob_name=blob_name,
        image_bytes=image_bytes,
        mime_type=mime_type,
    )
    return story_image_metadata(story, prompt, mime_type, gcs_uri, url)


def generate_native_gemini_image(genai_client, storage_client, story, prompt):
    response = genai_client.models.generate_content(
        model=IMAGE_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio=IMAGE_ASPECT_RATIO,
                image_size="2K",
            ),
        ),
    )
    candidates = response.candidates or []
    for candidate in candidates:
        parts = candidate.content.parts if candidate.content else []
        for part in parts or []:
            if part.inline_data and part.inline_data.data:
                mime_type = part.inline_data.mime_type or IMAGE_MIME_TYPE
                return generated_image_from_bytes(
                    storage_client=storage_client,
                    story=story,
                    prompt=prompt,
                    image_bytes=part.inline_data.data,
                    mime_type=mime_type,
                )
    raise RuntimeError("Gemini image model returned no inline image data")


def generate_imagen_style_image(genai_client, storage_client, story, prompt):
    response = genai_client.models.generate_images(
        model=IMAGE_MODEL,
        prompt=prompt,
        config=types.GenerateImagesConfig(
            number_of_images=1,
            aspect_ratio=IMAGE_ASPECT_RATIO,
            image_size="2K",
            output_mime_type=IMAGE_MIME_TYPE,
            output_compression_quality=88,
            person_generation=types.PersonGeneration.DONT_ALLOW,
            include_rai_reason=True,
            enhance_prompt=True,
        ),
    )
    generated_images = response.generated_images or []
    if not generated_images:
        raise RuntimeError("image model returned no images")

    generated = generated_images[0]
    if not generated.image:
        reason = generated.rai_filtered_reason or "image missing from response"
        raise RuntimeError(reason)

    image = generated.image
    if image.gcs_uri:
        gcs_uri = image.gcs_uri
        blob_name = gcs_uri.replace(f"gs://{BUCKET_NAME}/", "")
        mime_type = image.mime_type or IMAGE_MIME_TYPE
        return story_image_metadata(
            story=story,
            prompt=prompt,
            mime_type=mime_type,
            gcs_uri=gcs_uri,
            url=public_gcs_url(blob_name),
        )

    if not image.image_bytes:
        reason = generated.rai_filtered_reason or "image response contained no bytes"
        raise RuntimeError(reason)

    mime_type = image.mime_type or IMAGE_MIME_TYPE
    return generated_image_from_bytes(
        storage_client=storage_client,
        story=story,
        prompt=prompt,
        image_bytes=image.image_bytes,
        mime_type=mime_type,
    )


def generate_story_image(genai_client, storage_client, story, docs):
    prompt = build_image_prompt(story, docs)
    if IMAGE_MODEL.startswith("gemini-"):
        return generate_native_gemini_image(genai_client, storage_client, story, prompt)
    return generate_imagen_style_image(genai_client, storage_client, story, prompt)


def build_story(topic, docs, generated, stats=None):
    sources = cluster_to_sources(docs)
    headline = generated["headline"]
    story = {
        "id": f"st_{slugify(headline)[:24]}",
        "slug": slugify(headline),
        "sourceKey": cluster_source_key(topic, docs),
        "category": topic["category"],
        "country": topic["country"],
        "headline": headline,
        "aiSummary": generated["aiSummary"],
        "lenses": generated["lenses"],
        "sources": sources,
        "publishedAt": datetime.now(timezone.utc).isoformat(),
    }
    if stats:
        story["clusterStats"] = stats
    return story


def parse_story_time(story):
    return parse_iso_datetime(story.get("publishedAt"))


def story_key(story):
    return story.get("sourceKey") or story.get("slug") or story.get("id") or story.get("headline")


def load_existing_stories(bucket):
    blob = bucket.blob("synthesized/latest.json")
    if not blob.exists():
        return []
    try:
        data = json.loads(blob.download_as_text())
    except Exception as exc:
        print(f"Could not load existing latest.json for retention: {exc}")
        return []
    if not isinstance(data, list):
        return []
    return [story for story in data if isinstance(story, dict)]


def merge_retained_stories(new_stories, existing_stories):
    cutoff = datetime.now(timezone.utc) - timedelta(days=STORY_RETENTION_DAYS)
    merged = {}

    for story in new_stories:
        key = story_key(story)
        if key:
            merged[key] = story

    for story in existing_stories:
        key = story_key(story)
        if not key or key in merged:
            continue
        published_at = parse_story_time(story)
        if published_at and published_at >= cutoff:
            merged[key] = story

    stories = list(merged.values())
    stories.sort(
        key=lambda story: parse_story_time(story) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return stories[:MAX_STORIES]


def existing_stories_by_source_key(existing_stories):
    cutoff = datetime.now(timezone.utc) - timedelta(days=STORY_RETENTION_DAYS)
    return {
        story["sourceKey"]: story
        for story in existing_stories
        if isinstance(story.get("sourceKey"), str)
        and (parse_story_time(story) or datetime.min.replace(tzinfo=timezone.utc)) >= cutoff
    }


def evaluate_candidate_clusters(search_client):
    selected_by_key = {}
    skipped = []
    candidates = []

    for topic in CANDIDATE_TOPICS:
        raw_docs = retrieve_cluster(search_client, topic["query"])
        recent_docs = filter_recent_docs(raw_docs)
        docs = dedupe_docs_by_domain(recent_docs)
        stats = cluster_stats(topic, raw_docs, recent_docs, docs)
        source_key = cluster_source_key(topic, docs) if docs else ""
        skip_reason = quality_skip_reason(topic, stats)
        report_item = {
            **stats,
            "sourceKey": source_key,
            "skip_reason": skip_reason,
        }

        if skip_reason:
            skipped.append(report_item)
            print(f"Skipping '{topic['query']}': {skip_reason}.")
            continue

        cluster = {
            "topic": topic,
            "docs": docs,
            "sourceKey": source_key,
            "stats": stats,
        }
        existing = selected_by_key.get(source_key)
        if existing and cluster_rank(existing) >= cluster_rank(cluster):
            skipped.append({**report_item, "skip_reason": "duplicate lower-ranked sourceKey"})
            continue
        if existing:
            skipped.append(
                {
                    **existing["stats"],
                    "sourceKey": source_key,
                    "skip_reason": "duplicate lower-ranked sourceKey",
                }
            )
        selected_by_key[source_key] = cluster
        candidates.append(report_item)

    selected = sorted(selected_by_key.values(), key=cluster_rank, reverse=True)
    overflow = selected[MAX_NEW_CLUSTERS:]
    selected = selected[:MAX_NEW_CLUSTERS]
    for cluster in overflow:
        skipped.append(
            {
                **cluster["stats"],
                "sourceKey": cluster["sourceKey"],
                "skip_reason": f"outside top {MAX_NEW_CLUSTERS} ranked clusters",
            }
        )

    return selected, candidates, skipped


def upload_cache(stories, existing_stories=None, bucket=None):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bucket = bucket or storage.Client().bucket(BUCKET_NAME)
    existing_stories = existing_stories if existing_stories is not None else load_existing_stories(bucket)
    retained_stories = merge_retained_stories(stories, existing_stories)
    body = json.dumps(retained_stories, indent=2, ensure_ascii=False)

    # Timestamped archive (audit/history) + a stable `latest.json` that the
    # frontend fetches by a fixed public URL. Grant public read on latest.json
    # once (IAM / object ACL) — synthesis just overwrites the object.
    archive = f"synthesized/stories_{timestamp}.json"
    bucket.blob(archive).upload_from_string(body, content_type="application/json")
    bucket.blob("synthesized/latest.json").upload_from_string(
        body, content_type="application/json"
    )
    print(
        f"Retained {len(retained_stories)} visible stories "
        f"({len(stories)} new, {len(existing_stories)} previous, "
        f"{STORY_RETENTION_DAYS} day retention, max {MAX_STORIES})."
    )
    return (
        f"gs://{BUCKET_NAME}/{archive}",
        f"gs://{BUCKET_NAME}/synthesized/latest.json",
        retained_stories,
    )


def main(dry_run=False, refresh_report=None):
    if not DATA_STORE_ID and not SEARCH_ENGINE_ID:
        raise SystemExit(
            "Set SCOPE_DATA_STORE_ID (and optionally SCOPE_SEARCH_ENGINE_ID) "
            "before running. Discovery Engine retrieval must be verified first."
        )

    search_client = build_search_client()
    storage_client = storage.Client()
    bucket = storage_client.bucket(BUCKET_NAME)
    existing_stories = load_existing_stories(bucket)
    existing_by_source_key = existing_stories_by_source_key(existing_stories)

    clusters, candidates, skipped = evaluate_candidate_clusters(search_client)
    report = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": dry_run,
        "candidate_count": len(candidates),
        "selected_count": len(clusters),
        "skipped_count": len(skipped),
        "reused_count": 0,
        "synthesized_count": 0,
        "image_generated_count": 0,
        "image_failed_count": 0,
        "final_visible_count": 0,
        "candidates": candidates,
        "skipped": skipped,
        "clusters": [],
    }
    stories = []
    genai_client = None
    for cluster in clusters:
        topic = cluster["topic"]
        docs = cluster["docs"]
        source_key = cluster["sourceKey"]
        cluster_report = {
            **cluster["stats"],
            "sourceKey": source_key,
            "action": "",
            "headline": "",
            "image": "",
        }
        if source_key in existing_by_source_key:
            story = existing_by_source_key[source_key]
            stories.append(story)
            report["reused_count"] += 1
            cluster_report["action"] = "reused"
            cluster_report["headline"] = story.get("headline", "")
            print(
                f"Reused: {story['headline']} "
                f"({len(story.get('sources', []))} sources, sourceKey {source_key})"
            )
            report["clusters"].append(cluster_report)
            continue
        if dry_run:
            cluster_report["action"] = "would_synthesize"
            report["clusters"].append(cluster_report)
            print(
                f"Dry run: would synthesize '{topic['query']}' "
                f"({cluster['stats']['domain_count']} domains, sourceKey {source_key})"
            )
            continue

        if genai_client is None:
            genai_client = build_genai_client()
        generated = synthesize_lenses(genai_client, docs)
        story = build_story(topic, docs, generated, stats=cluster["stats"])
        report["synthesized_count"] += 1
        cluster_report["action"] = "synthesized"
        cluster_report["headline"] = story["headline"]
        try:
            story["image"] = generate_story_image(
                genai_client=genai_client,
                storage_client=storage_client,
                story=story,
                docs=docs,
            )
            report["image_generated_count"] += 1
            cluster_report["image"] = "generated"
            print(f"Generated image: {story['image']['gcsUri']}")
        except Exception as exc:
            report["image_failed_count"] += 1
            cluster_report["image"] = f"failed: {exc}"
            print(f"Image generation failed for '{story['headline']}': {exc}")
        stories.append(story)
        print(f"Synthesized: {story['headline']} ({len(docs)} sources)")
        report["clusters"].append(cluster_report)

    if dry_run:
        print("\nDry run complete; latest.json was not updated.")
        report["finished_at"] = datetime.now(timezone.utc).isoformat()
        return report

    if not stories:
        raise SystemExit("No stories synthesized or reused; check retrieval and topics.")

    archive_uri, latest_uri, retained_stories = upload_cache(
        stories,
        existing_stories=existing_stories,
        bucket=bucket,
    )
    report["archive_uri"] = archive_uri
    report["latest_uri"] = latest_uri
    report["final_visible_count"] = len(retained_stories)
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    print(f"\nUploaded {len(stories)} synthesized stories to:")
    print(f"  archive: {archive_uri}")
    print(f"  latest:  {latest_uri}")
    return report


if __name__ == "__main__":
    main()
