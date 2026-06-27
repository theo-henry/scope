"""LLM-as-a-judge evaluation for Scope's Tri-Perspective Lens synthesis.

Metrics (RAGAS-inspired):
  faithfulness         — claims in the synthesis are grounded in the retrieved
                         source article snippets (0–100)
  lens_distinctiveness — the three lenses offer meaningfully different perspectives
                         rather than restating each other (0–100)
  completeness         — key facts present across the sources appear in the
                         synthesis (0–100)

Also records per-story judge latency (ms).

The script:
  1. Loads synthesized/latest.json from GCS.
  2. For each story, re-retrieves its source cluster from Discovery Engine
     using the category-level query (same short queries that work reliably
     on this store — see LESSONS.md).
  3. Asks Gemini to score the synthesis against the retrieved articles.
  4. Prints a per-story + aggregate report.
  5. Saves a JSON report to gs://<bucket>/evaluations/eval_<timestamp>.json.

Limitation: generator and judge are the same model (Gemini 2.5 Flash).
Self-evaluation introduces optimism bias; scores should be interpreted as
relative (story-to-story) rather than absolute.

Prerequisites (same env vars as synthesize.py):
  export GEMINI_API_KEY="..."
  export SCOPE_DATA_STORE_ID="scope-news-raw-datastore"
  export SCOPE_SEARCH_ENGINE_ID="scope-news-search"
  python backend/evaluate.py
"""

import json
import os
import time
from datetime import datetime, timezone

from google import genai
from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine, storage
from google.genai import types


PROJECT_ID = os.environ.get("SCOPE_PROJECT_ID", "scope-mvp-prod")
LOCATION = os.environ.get("DISCOVERY_ENGINE_LOCATION", "global")
DATA_STORE_ID = os.environ.get("SCOPE_DATA_STORE_ID", "")
SEARCH_ENGINE_ID = os.environ.get("SCOPE_SEARCH_ENGINE_ID", "")
BUCKET_NAME = os.environ.get("SCOPE_BUCKET_NAME", "scope-news-raw-data")
MODEL = os.environ.get("SCOPE_GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
CLUSTER_SIZE = 8

# Short retrieval queries keyed by category — mirrors synthesize.py TOPICS and
# respects Discovery Engine's strict relevance filter on this small store.
CATEGORY_QUERY = {
    "Finance":  "central bank interest rates",
    "Markets":  "stock market earnings",
    "Politics": "tax",
    "Tech/AI":  "artificial intelligence regulation",
    "World":    "trade war",
}

JUDGE_SYSTEM = (
    "You are a strict, objective evaluator for a news synthesis AI. "
    "You will receive source article snippets followed by an AI-generated synthesis. "
    "Score the synthesis on three metrics (0–100 each). "
    "Deduct points only for clear, specific failures. Be consistent across stories."
)

JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "faithfulness":              {"type": "integer"},
        "faithfulness_rationale":    {"type": "string"},
        "lens_distinctiveness":      {"type": "integer"},
        "lens_rationale":            {"type": "string"},
        "completeness":              {"type": "integer"},
        "completeness_rationale":    {"type": "string"},
    },
    "required": [
        "faithfulness", "faithfulness_rationale",
        "lens_distinctiveness", "lens_rationale",
        "completeness", "completeness_rationale",
    ],
}


def build_genai_client():
    if GEMINI_API_KEY:
        return genai.Client(api_key=GEMINI_API_KEY)
    return genai.Client(vertexai=True, project=PROJECT_ID, location="global")


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


def retrieve_cluster(search_client, query):
    request = discoveryengine.SearchRequest(
        serving_config=serving_config(), query=query, page_size=CLUSTER_SIZE
    )
    docs = []
    for result in search_client.search(request).results:
        data = dict(result.document.struct_data)
        docs.append({
            "title":   data.get("title", ""),
            "summary": (data.get("summary", "") or "").strip(),
            "source":  data.get("source", ""),
        })
    return docs


def load_latest_stories():
    blob = storage.Client().bucket(BUCKET_NAME).blob("synthesized/latest.json")
    return json.loads(blob.download_as_text())


def build_judge_prompt(story, docs):
    source_block = "\n\n".join(
        f"SOURCE {i + 1} [{doc['source']}]\n"
        f"Title: {doc['title']}\n"
        f"{doc['summary']}"
        for i, doc in enumerate(docs)
    )

    reformist = story["lenses"]["reformist"]
    skeptic   = story["lenses"]["skeptic"]

    synthesis_block = (
        f"HEADLINE: {story['headline']}\n\n"
        f"LENS 1 — Institutional (Neutral Synthesis):\n"
        f"{story['lenses']['institutional']['synthesis']}\n\n"
        f"LENS 2 — Reformist (Divergence):\n"
        f"{reformist['summary']}\n"
        f"Agreements: {' | '.join(reformist['agreements'])}\n"
        f"Divergences: {' | '.join(reformist['divergences'])}\n\n"
        f"LENS 3 — Skeptic (Bias & Validity):\n"
        f"{skeptic['summary']}\n"
        f"Validity score: {skeptic['validityScore']}/100 — {skeptic['validityRationale']}"
    )

    return (
        f"SOURCE ARTICLES ({len(docs)} retrieved):\n\n"
        f"{source_block}\n\n"
        f"{'─' * 60}\n\n"
        f"AI SYNTHESIS TO EVALUATE:\n\n"
        f"{synthesis_block}\n\n"
        f"{'─' * 60}\n\n"
        "Score the synthesis on these three metrics:\n\n"
        "1. FAITHFULNESS (0–100): Every claim in the synthesis is directly "
        "supported by the source articles above. Deduct for facts not present "
        "in any source.\n\n"
        "2. LENS DISTINCTIVENESS (0–100): The three lenses offer genuinely "
        "different perspectives — Lens 1 is consensus, Lens 2 is divergence, "
        "Lens 3 is critical. Deduct if lenses mostly restate each other.\n\n"
        "3. COMPLETENESS (0–100): The synthesis captures the key facts and "
        "perspectives present across the sources. Deduct for major omissions."
    )


def evaluate_story(genai_client, search_client, story):
    query = CATEGORY_QUERY.get(story["category"], story["category"])
    docs = retrieve_cluster(search_client, query)

    if not docs:
        print(f"  Warning: no documents retrieved for '{query}' — skipping.")
        return None

    prompt = build_judge_prompt(story, docs)

    t0 = time.perf_counter()
    response = genai_client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=JUDGE_SYSTEM,
            temperature=0.1,
            response_mime_type="application/json",
            response_schema=JUDGE_SCHEMA,
        ),
    )
    latency_ms = round((time.perf_counter() - t0) * 1000)

    scores = json.loads(response.text)
    scores["latency_ms"]        = latency_ms
    scores["sources_retrieved"] = len(docs)
    scores["retrieval_query"]   = query
    return scores


def print_report(results, model):
    metrics = ["faithfulness", "lens_distinctiveness", "completeness"]
    means = {
        m: round(sum(r[m] for r in results) / len(results))
        for m in metrics
    }
    avg_latency = round(sum(r["latency_ms"] for r in results) / len(results))

    print(f"\n{'=' * 64}")
    print("SCOPE SYNTHESIS EVALUATION REPORT")
    print(f"{'=' * 64}")
    for r in results:
        print(f"\n  {r['headline'][:60]}")
        print(f"    Faithfulness:         {r['faithfulness']:>3}/100  — {r['faithfulness_rationale'][:80]}")
        print(f"    Lens Distinctiveness: {r['lens_distinctiveness']:>3}/100  — {r['lens_rationale'][:80]}")
        print(f"    Completeness:         {r['completeness']:>3}/100  — {r['completeness_rationale'][:80]}")
        print(f"    Latency:              {r['latency_ms']} ms  ({r['sources_retrieved']} sources retrieved)")

    print(f"\n{'─' * 64}")
    print("AGGREGATE")
    print(f"  Stories evaluated:    {len(results)}")
    print(f"  Faithfulness:         {means['faithfulness']}/100")
    print(f"  Lens Distinctiveness: {means['lens_distinctiveness']}/100")
    print(f"  Completeness:         {means['completeness']}/100")
    print(f"  Avg judge latency:    {avg_latency} ms")
    print(f"  Judge model:          {model}")
    print(f"  Note: generator == judge ({model}); scores reflect relative")
    print(f"        quality across stories, not absolute ground truth.")
    print(f"{'=' * 64}\n")

    return means, avg_latency


def main():
    if not DATA_STORE_ID and not SEARCH_ENGINE_ID:
        raise SystemExit(
            "Set SCOPE_DATA_STORE_ID (and optionally SCOPE_SEARCH_ENGINE_ID) before running."
        )

    print("Loading synthesized stories from GCS...")
    stories = load_latest_stories()
    print(f"Evaluating {len(stories)} stories with {MODEL} as judge...\n")

    genai_client  = build_genai_client()
    search_client = build_search_client()

    results = []
    for story in stories:
        print(f"  [{story['category']}] {story['headline'][:55]}...")
        scores = evaluate_story(genai_client, search_client, story)
        if scores is None:
            continue
        results.append({
            "story_id":  story["id"],
            "headline":  story["headline"],
            "category":  story["category"],
            **scores,
        })

    if not results:
        raise SystemExit("No stories could be evaluated. Check Discovery Engine retrieval.")

    means, avg_latency = print_report(results, MODEL)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report = {
        "evaluated_at":  datetime.now(timezone.utc).isoformat(),
        "judge_model":   MODEL,
        "story_count":   len(results),
        "aggregate": {
            **means,
            "avg_latency_ms": avg_latency,
        },
        "stories": results,
    }

    blob_name = f"evaluations/eval_{timestamp}.json"
    storage.Client().bucket(BUCKET_NAME).blob(blob_name).upload_from_string(
        json.dumps(report, indent=2, ensure_ascii=False),
        content_type="application/json",
    )
    print(f"Report saved to gs://{BUCKET_NAME}/{blob_name}")


if __name__ == "__main__":
    main()
