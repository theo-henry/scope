# Scope Tasks

This file tracks completed work and the exact next steps. Keep it updated as the single operational handoff list for future agents.

## Completed

- Read `PRD.md` and extracted the core architecture.
- Confirmed actual GCP project ID: `scope-mvp-prod`.
- Confirmed raw GCS bucket name: `scope-news-raw-data`.
- Created backend directory: `backend/`.
- Created Python virtual environment: `backend/venv/`.
- Added root `.gitignore` entries for `venv/`, `.env`, `node_modules/`, `__pycache__/`, and `*.pyc`.
- Added `backend/requirements.txt` with:
  - `google-cloud-storage`
  - `feedparser`
- Added `backend/ingest.py`.
- Installed backend dependencies into `backend/venv`.
- Ran ingestion successfully.
- Uploaded raw JSON article archive to `gs://scope-news-raw-data/raw/`.
- Updated ingestion to also upload Discovery Engine-ready NDJSON to `gs://scope-news-raw-data/agent-search/`.
- Verified at least one `.ndjson` file appears in the bucket.
- Migrated Discovery Engine setup instructions into the memory system.
- Confirmed Google Cloud Console path for Discovery Engine / Agent Search is `https://console.cloud.google.com/gen-app-builder`.
- Created memory system files:
  - `CLAUDE.md`
  - `TASKS.md`
  - `LESSONS.md`

## Current Position

We are about to create the Discovery Engine / Agent Search data store from:

```text
gs://scope-news-raw-data/agent-search/*.ndjson
```

No Gemini synthesis work should begin until Discovery Engine retrieval is verified.

## Next Tasks

1. In Google Cloud Console, open AI Applications / Agent Search:

```text
https://console.cloud.google.com/gen-app-builder
```

2. Confirm project selector is:

```text
scope-mvp-prod
```

3. Create a Search app / data store:

- App type: Search
- Data source: Cloud Storage
- Format: structured data / JSON Lines / NDJSON
- Import path: `gs://scope-news-raw-data/agent-search/*.ndjson`
- Document ID field: `id`
- Suggested data store display name: `scope-news-raw-datastore`
- Suggested search app display name: `scope-news-search`

4. Wait for import/indexing to complete.

5. Verify imported document count is greater than `0`.

6. Test search in the Console preview using a term from one BBC headline.

7. If available, list generated IDs with:

```bash
gcloud alpha discovery-engine data-stores list \
  --project="scope-mvp-prod" \
  --location="global"

gcloud alpha discovery-engine engines list \
  --project="scope-mvp-prod" \
  --location="global"
```

8. Record generated IDs in `CLAUDE.md`:

```text
SCOPE_DATA_STORE_ID=...
SCOPE_SEARCH_ENGINE_ID=...
DISCOVERY_ENGINE_LOCATION=global
```

9. Add a backend retrieval test script:

```text
backend/search_test.py
```

The script should query Discovery Engine / Agent Search and print retrieved documents.

10. Run the retrieval test locally and confirm it returns BBC articles.

11. After retrieval is verified, create the Gemini synthesis script:

```text
backend/synthesize.py
```

12. Define and enforce the Tri-Perspective Lens JSON schema.

13. Save synthesized output to a cache prefix, likely:

```text
gs://scope-news-raw-data/synthesized/
```

14. Connect the Next.js frontend to cached synthesized JSON.

15. Replace mock frontend data with real cached data.

16. Build grounded chat behavior using only loaded/retrieved article context.

17. Add deployment and refresh documentation.

## Deferred Tasks

- Add more news sources beyond BBC.
- Add fallback source chain: GNews, NewsData, Guardian, GDELT.
- Add Cloud Scheduler / Cloud Function or Cloud Run job for scheduled ingestion.
- Add clustering across sources for same-story grouping.
- Add LLM-as-judge validation loop.
- Add Vercel deployment configuration.
- Add production service account with least-privilege IAM.
