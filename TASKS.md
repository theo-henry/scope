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
- Created Discovery Engine / Agent Search data store `scope-news-raw-datastore`.
- Imported `10/10` documents from `gs://scope-news-raw-data/agent-search/bbc_world_20260627T095745Z.ndjson` using `id` as the document ID field.
- Created Search engine `scope-news-search` connected to the data store.
- Verified retrieval with query `BBC news`, returning `3` results with `totalSize: 10`.
- Recorded generated Discovery Engine IDs in `CLAUDE.md`.
- Created memory system files:
  - `CLAUDE.md`
  - `TASKS.md`
  - `LESSONS.md`

## Current Position

Discovery Engine / Agent Search retrieval is verified from:

```text
gs://scope-news-raw-data/agent-search/*.ndjson
```

Next work can begin on Gemini synthesis, using Discovery Engine retrieval before any Gemini generation.

## Next Tasks

1. ~~Add a backend retrieval test script: `backend/search_test.py`.~~ DONE.
   The script queries Discovery Engine / Agent Search and prints retrieved
   documents. It reads `SCOPE_DATA_STORE_ID` (and optional
   `SCOPE_SEARCH_ENGINE_ID`) from the environment, defaulting project to
   `scope-mvp-prod` and location to `global`. Added
   `google-cloud-discoveryengine` to `backend/requirements.txt` (must be
   pip-installed into `backend/venv` before running).

2. Optionally run the local retrieval test and confirm it returns BBC articles:

```bash
export SCOPE_DATA_STORE_ID="scope-news-raw-datastore"
export SCOPE_SEARCH_ENGINE_ID="scope-news-search"
backend/venv/bin/python backend/search_test.py "world"
```

3. ~~Create the Gemini synthesis script: `backend/synthesize.py`.~~ DONE.
   Retrieves a per-topic cluster from Discovery Engine, calls Gemini 1.5 Flash on
   Vertex AI with a structured `response_schema`, assembles the full Story object
   (metadata + grounded source list from the retrieved docs), and uploads to
   `gs://scope-news-raw-data/synthesized/`. Added `google-genai` to
   `backend/requirements.txt`. NOT YET RUN against Vertex — needs ADC + Vertex AI
   enabled and `SCOPE_DATA_STORE_ID`/`SCOPE_SEARCH_ENGINE_ID` exported.

4. ~~Define and enforce the Tri-Perspective Lens JSON schema.~~ DONE.
   The schema is the shared contract between `backend/synthesize.py`
   (`LENS_RESPONSE_SCHEMA`) and the frontend (`scope-news-reader/lib/types.ts`:
   `Story` / `TriPerspectiveLens`). Restructured the frontend to three EXPLICIT
   named lenses per PRD §2 (institutional / reformist / skeptic): updated
   `lib/types.ts`, all 8 mock stories in `lib/mock-data.ts`, the coverage view
   (new `components/coverage/lens-sections.tsx`, header, agreement-divergence),
   the feed card, and `lib/mock-chat.ts`. Frontend `tsc` + `next build` pass.

5. ~~Save synthesized output to a cache prefix.~~ DONE — `synthesize.py` writes to
   `gs://scope-news-raw-data/synthesized/stories_<timestamp>.json`.

6. Run the COMMITTED `synthesize.py` in Cloud Shell (git pull first), with
   `GEMINI_API_KEY` + the data-store IDs exported. Uses the Gemini Developer API
   and `gemini-2.5-flash` (the PRD's 1.5 Flash is no longer served on that API).
   Verify the cached `stories_<ts>.json` validates against the Story schema.
   NOTE: an earlier ad-hoc Cloud Shell script wrote
   `gs://scope-news-raw-data/synthesized/20260627T124918Z.json` with a WRONG flat
   schema (query/summary/articles, no lenses) — ignore or delete it; the committed
   script writes `stories_<ts>.json`, a distinct prefix.

7. Connect the Next.js frontend to the cached synthesized JSON (add a data-access
   layer / API route that reads the cache and swap it in for `lib/mock-data.ts`;
   the Story shape already matches, so the UI should not need changes).

8. Build grounded chat behavior using only loaded/retrieved article context
   (replace `lib/mock-chat.ts` with a real Vertex AI grounded route).

9. Add deployment and refresh documentation.

## Deferred Tasks

- Add more news sources beyond BBC.
- Add fallback source chain: GNews, NewsData, Guardian, GDELT.
- Add Cloud Scheduler / Cloud Function or Cloud Run job for scheduled ingestion.
- Add clustering across sources for same-story grouping.
- Add LLM-as-judge validation loop.
- Add Vercel deployment configuration.
- Add production service account with least-privilege IAM.
