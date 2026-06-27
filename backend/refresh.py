"""One-command Scope data refresh.

Pipeline:
  1. Fetch current RSS articles and upload raw + Discovery Engine NDJSON to GCS.
  2. Trigger a Discovery Engine incremental import for that NDJSON file.
  3. Wait briefly for indexing to settle.
  4. Run synthesis, including generated story images and retained older stories.

Run:
    export SCOPE_PROJECT_ID="scope-mvp-prod"
    export SCOPE_DATA_STORE_ID="scope-news-raw-datastore"
    export SCOPE_SEARCH_ENGINE_ID="scope-news-search"
    export GEMINI_API_KEY="..."  # or SCOPE_GEMINI_SECRET_ID when IAM is set up
    backend/venv/bin/python backend/refresh.py
"""

import os
import sys
import time
from pathlib import Path

from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine


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
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import ingest  # noqa: E402
import synthesize  # noqa: E402


PROJECT_ID = os.environ.get("SCOPE_PROJECT_ID", "scope-mvp-prod")
LOCATION = os.environ.get("DISCOVERY_ENGINE_LOCATION", "global")
DATA_STORE_ID = os.environ.get("SCOPE_DATA_STORE_ID", "")
IMPORT_TIMEOUT_SECONDS = int(os.environ.get("SCOPE_IMPORT_TIMEOUT_SECONDS", "900"))
INDEX_SETTLE_SECONDS = int(os.environ.get("SCOPE_INDEX_SETTLE_SECONDS", "120"))


def build_document_client():
    api_endpoint = (
        "discoveryengine.googleapis.com"
        if LOCATION == "global"
        else f"{LOCATION}-discoveryengine.googleapis.com"
    )
    return discoveryengine.DocumentServiceClient(
        client_options=ClientOptions(api_endpoint=api_endpoint)
    )


def branch_name():
    if not DATA_STORE_ID:
        raise SystemExit(
            "Set SCOPE_DATA_STORE_ID before running refresh.py. Discovery Engine "
            "imports target the data store branch, not the search engine."
        )
    return (
        f"projects/{PROJECT_ID}/locations/{LOCATION}/collections/default_collection"
        f"/dataStores/{DATA_STORE_ID}/branches/default_branch"
    )


def import_documents(ndjson_uri):
    client = build_document_client()
    request = discoveryengine.ImportDocumentsRequest(
        parent=branch_name(),
        gcs_source=discoveryengine.GcsSource(
            input_uris=[ndjson_uri],
            data_schema="custom",
        ),
        reconciliation_mode=(
            discoveryengine.ImportDocumentsRequest.ReconciliationMode.INCREMENTAL
        ),
        id_field="id",
    )

    print(f"Importing Discovery Engine documents from {ndjson_uri}")
    operation = client.import_documents(request=request)
    operation_name = getattr(getattr(operation, "operation", None), "name", "unknown")
    print(f"Import operation: {operation_name}")
    operation.result(timeout=IMPORT_TIMEOUT_SECONDS)
    print("Discovery Engine import completed.")


def main():
    print("Fetching RSS articles...")
    articles = ingest.fetch_articles()
    if not articles:
        raise SystemExit("No articles fetched; aborting refresh.")

    raw_json_uri, ndjson_uri = ingest.upload_articles_to_gcs(articles)
    print(f"Uploaded {len(articles)} raw articles to {raw_json_uri}")
    print(f"Uploaded {len(articles)} Agent Search documents to {ndjson_uri}")

    import_documents(ndjson_uri)

    if INDEX_SETTLE_SECONDS > 0:
        print(f"Waiting {INDEX_SETTLE_SECONDS}s for indexing to settle...")
        time.sleep(INDEX_SETTLE_SECONDS)

    print("Running synthesis and image generation...")
    synthesize.main()


if __name__ == "__main__":
    main()
