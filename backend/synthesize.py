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
# Auth path for Gemini. If a key is set (Gemini Developer API / AI Studio), use it;
# otherwise fall back to Vertex AI via ADC. Both go through the google-genai SDK.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
GEMINI_SECRET_ID = os.environ.get("SCOPE_GEMINI_SECRET_ID", "")

CLUSTER_SIZE = 8  # PRD: 5-8 outlets per story.

# Each topic becomes one synthesized story. The retrieval query forms the
# cluster; category/country tag it for the frontend's typed filters. Cross-source
# same-story clustering is a deferred task (TASKS.md) that will replace this.
TOPICS = [
    {"query": "central bank interest rates", "category": "Finance", "country": "Global"},
    {"query": "stock market earnings", "category": "Markets", "country": "United States"},
    {"query": "tax", "category": "Politics", "country": "United States"},
    {"query": "artificial intelligence regulation", "category": "Tech/AI", "country": "Global"},
    {"query": "trade war", "category": "World", "country": "Global"},
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
            }
        )
    return docs


def slugify(text):
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:60] or "story"


def domain_of(url):
    host = urlparse(url).netloc
    return host[4:] if host.startswith("www.") else host


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


def build_story(topic, docs, generated):
    sources = cluster_to_sources(docs)
    headline = generated["headline"]
    return {
        "id": f"st_{slugify(headline)[:24]}",
        "slug": slugify(headline),
        "category": topic["category"],
        "country": topic["country"],
        "headline": headline,
        "aiSummary": generated["aiSummary"],
        "lenses": generated["lenses"],
        "sources": sources,
        "publishedAt": datetime.now(timezone.utc).isoformat(),
    }


def parse_story_time(story):
    raw = story.get("publishedAt")
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def story_key(story):
    return story.get("slug") or story.get("id") or story.get("headline")


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


def upload_cache(stories):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bucket = storage.Client().bucket(BUCKET_NAME)
    existing_stories = load_existing_stories(bucket)
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
    return f"gs://{BUCKET_NAME}/{archive}", f"gs://{BUCKET_NAME}/synthesized/latest.json"


def main():
    if not DATA_STORE_ID and not SEARCH_ENGINE_ID:
        raise SystemExit(
            "Set SCOPE_DATA_STORE_ID (and optionally SCOPE_SEARCH_ENGINE_ID) "
            "before running. Discovery Engine retrieval must be verified first."
        )

    search_client = build_search_client()
    genai_client = build_genai_client()
    storage_client = storage.Client()

    stories = []
    for topic in TOPICS:
        docs = retrieve_cluster(search_client, topic["query"])
        if not docs:
            print(f"Skipping '{topic['query']}': no documents retrieved.")
            continue
        generated = synthesize_lenses(genai_client, docs)
        story = build_story(topic, docs, generated)
        try:
            story["image"] = generate_story_image(
                genai_client=genai_client,
                storage_client=storage_client,
                story=story,
                docs=docs,
            )
            print(f"Generated image: {story['image']['gcsUri']}")
        except Exception as exc:
            print(f"Image generation failed for '{story['headline']}': {exc}")
        stories.append(story)
        print(f"Synthesized: {story['headline']} ({len(docs)} sources)")

    if not stories:
        raise SystemExit("No stories synthesized; check retrieval and topics.")

    archive_uri, latest_uri = upload_cache(stories)
    print(f"\nUploaded {len(stories)} synthesized stories to:")
    print(f"  archive: {archive_uri}")
    print(f"  latest:  {latest_uri}")


if __name__ == "__main__":
    main()
