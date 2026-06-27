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
from datetime import datetime, timezone
from urllib.parse import urlparse

from google import genai
from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine, storage
from google.genai import types


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
# Auth path for Gemini. If a key is set (Gemini Developer API / AI Studio), use it;
# otherwise fall back to Vertex AI via ADC. Both go through the google-genai SDK.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

CLUSTER_SIZE = 8  # PRD: 5-8 outlets per story.

# Each topic becomes one synthesized story. The retrieval query forms the
# cluster; category/country tag it for the frontend's typed filters. Cross-source
# same-story clustering is a deferred task (TASKS.md) that will replace this.
TOPICS = [
    {"query": "central bank interest rates", "category": "Finance", "country": "Global"},
    {"query": "stock market earnings", "category": "Markets", "country": "United States"},
    {"query": "government budget politics", "category": "Politics", "country": "United States"},
    {"query": "artificial intelligence regulation", "category": "Tech/AI", "country": "Global"},
    {"query": "global trade and economy", "category": "World", "country": "Global"},
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


def build_genai_client():
    # Gemini Developer API key (what was used in Cloud Shell) takes precedence;
    # otherwise authenticate to Vertex AI through ADC.
    if GEMINI_API_KEY:
        return genai.Client(api_key=GEMINI_API_KEY)
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


def upload_cache(stories):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"synthesized/stories_{timestamp}.json"
    body = json.dumps(stories, indent=2, ensure_ascii=False)
    blob = storage.Client().bucket(BUCKET_NAME).blob(filename)
    blob.upload_from_string(body, content_type="application/json")
    return f"gs://{BUCKET_NAME}/{filename}"


def main():
    if not DATA_STORE_ID and not SEARCH_ENGINE_ID:
        raise SystemExit(
            "Set SCOPE_DATA_STORE_ID (and optionally SCOPE_SEARCH_ENGINE_ID) "
            "before running. Discovery Engine retrieval must be verified first."
        )

    search_client = build_search_client()
    genai_client = build_genai_client()

    stories = []
    for topic in TOPICS:
        docs = retrieve_cluster(search_client, topic["query"])
        if not docs:
            print(f"Skipping '{topic['query']}': no documents retrieved.")
            continue
        generated = synthesize_lenses(genai_client, docs)
        story = build_story(topic, docs, generated)
        stories.append(story)
        print(f"Synthesized: {story['headline']} ({len(docs)} sources)")

    if not stories:
        raise SystemExit("No stories synthesized; check retrieval and topics.")

    uri = upload_cache(stories)
    print(f"\nUploaded {len(stories)} synthesized stories to {uri}")


if __name__ == "__main__":
    main()
