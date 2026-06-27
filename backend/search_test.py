"""Retrieval smoke test for the Scope Discovery Engine / Agent Search data store.

Run this AFTER the data store has finished importing the NDJSON from
`gs://scope-news-raw-data/agent-search/*.ndjson` and the generated IDs have been
recorded in CLAUDE.md. It issues a search query and prints the retrieved
documents so we can confirm retrieval works before any Gemini synthesis.

Usage:
    # IDs come from the Console after the data store is created.
    export SCOPE_DATA_STORE_ID="scope-news-raw-datastore_..."
    # Optional: if a Search app/engine was created, prefer querying it.
    export SCOPE_SEARCH_ENGINE_ID="scope-news-search_..."

    backend/venv/bin/python backend/search_test.py
    backend/venv/bin/python backend/search_test.py "your search term"
"""

import os
import sys

from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine


PROJECT_ID = os.environ.get("SCOPE_PROJECT_ID", "scope-mvp-prod")
LOCATION = os.environ.get("DISCOVERY_ENGINE_LOCATION", "global")
DATA_STORE_ID = os.environ.get("SCOPE_DATA_STORE_ID", "")
SEARCH_ENGINE_ID = os.environ.get("SCOPE_SEARCH_ENGINE_ID", "")
DEFAULT_QUERY = "world news"
PAGE_SIZE = 10


def build_client():
    # `global` uses the default endpoint; regional locations are prefixed.
    api_endpoint = (
        "discoveryengine.googleapis.com"
        if LOCATION == "global"
        else f"{LOCATION}-discoveryengine.googleapis.com"
    )
    client_options = ClientOptions(api_endpoint=api_endpoint)
    return discoveryengine.SearchServiceClient(client_options=client_options)


def build_serving_config():
    # Prefer the Search app/engine serving config when an engine ID is set;
    # otherwise query the data store directly. Both expose `default_config`.
    if SEARCH_ENGINE_ID:
        return (
            f"projects/{PROJECT_ID}/locations/{LOCATION}"
            f"/collections/default_collection/engines/{SEARCH_ENGINE_ID}"
            f"/servingConfigs/default_config"
        )
    return (
        f"projects/{PROJECT_ID}/locations/{LOCATION}"
        f"/collections/default_collection/dataStores/{DATA_STORE_ID}"
        f"/servingConfigs/default_config"
    )


def search(client, serving_config, query):
    request = discoveryengine.SearchRequest(
        serving_config=serving_config,
        query=query,
        page_size=PAGE_SIZE,
    )
    return client.search(request)


def print_results(response, query):
    results = list(response.results)
    print(f"Query: {query!r}")
    print(f"Returned {len(results)} document(s)\n")

    for index, result in enumerate(results, start=1):
        # Structured NDJSON fields land in document.struct_data.
        data = dict(result.document.struct_data)
        title = data.get("title", "(no title)")
        link = data.get("link", "")
        source = data.get("source", "")
        summary = (data.get("summary", "") or "").strip()
        if len(summary) > 160:
            summary = summary[:157] + "..."

        print(f"{index}. {title}")
        if source:
            print(f"   source: {source}")
        if link:
            print(f"   link:   {link}")
        if summary:
            print(f"   summary: {summary}")
        print(f"   doc id: {result.document.id}")
        print()


def main():
    if not DATA_STORE_ID and not SEARCH_ENGINE_ID:
        raise SystemExit(
            "Set SCOPE_DATA_STORE_ID (and optionally SCOPE_SEARCH_ENGINE_ID) "
            "from the values recorded in CLAUDE.md before running this script."
        )

    query = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_QUERY

    client = build_client()
    serving_config = build_serving_config()
    response = search(client, serving_config, query)
    print_results(response, query)


if __name__ == "__main__":
    main()
