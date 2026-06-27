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
import json
import time
from pathlib import Path
from datetime import datetime, timezone

from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine, storage


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
DRY_RUN = os.environ.get("SCOPE_REFRESH_DRY_RUN", "").lower() in {"1", "true", "yes"}
BUCKET_NAME = os.environ.get("SCOPE_BUCKET_NAME", "scope-news-raw-data")


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
    return operation_name


def upload_refresh_report(report):
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    blob_name = f"refresh-reports/refresh_{timestamp}.json"
    body = json.dumps(report, indent=2, ensure_ascii=False)
    storage.Client().bucket(BUCKET_NAME).blob(blob_name).upload_from_string(
        body,
        content_type="application/json",
    )
    uri = f"gs://{BUCKET_NAME}/{blob_name}"
    print(f"Uploaded refresh report to {uri}")
    return uri


def main():
    report = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": DRY_RUN,
        "ingest": {},
        "import": {},
    }
    print("Fetching RSS articles...")
    articles, source_stats = ingest.fetch_articles_with_report()
    if not articles:
        raise SystemExit("No articles fetched; aborting refresh.")
    report["ingest"] = {
        "article_count": len(articles),
        "source_count": len(source_stats),
        "sources": source_stats,
    }

    raw_json_uri, ndjson_uri = ingest.upload_articles_to_gcs(articles)
    print(f"Uploaded {len(articles)} raw articles to {raw_json_uri}")
    print(f"Uploaded {len(articles)} Agent Search documents to {ndjson_uri}")
    report["ingest"]["raw_json_uri"] = raw_json_uri
    report["ingest"]["ndjson_uri"] = ndjson_uri

    operation_name = import_documents(ndjson_uri)
    report["import"] = {
        "operation": operation_name,
        "ndjson_uri": ndjson_uri,
        "index_settle_seconds": INDEX_SETTLE_SECONDS,
    }

    if INDEX_SETTLE_SECONDS > 0:
        print(f"Waiting {INDEX_SETTLE_SECONDS}s for indexing to settle...")
        time.sleep(INDEX_SETTLE_SECONDS)

    print("Running synthesis and image generation...")
    synthesis_report = synthesize.main(dry_run=DRY_RUN, refresh_report=report)
    report["synthesis"] = synthesis_report
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    upload_refresh_report(report)


if __name__ == "__main__":
    main()
