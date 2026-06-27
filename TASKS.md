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

The backend pipeline is complete end-to-end and verified:
multi-feed ingest -> GCS -> Discovery Engine import (123 docs) -> retrieval ->
Gemini lens synthesis -> cached JSON. `synthesize.py` produced 5 lens stories to
`gs://scope-news-raw-data/synthesized/stories_20260627T135452Z.json` using
`gemini-2.5-flash` via the Gemini Developer API key.

The frontend (`scope-news-reader`) is restructured to the three explicit lenses but
STILL READS MOCK DATA. The next discrete unit of work is wiring the frontend to the
cached synthesized JSON (Task 7) — a clean, self-contained frontend task and a good
handoff boundary.

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

3. ~~Create the Gemini synthesis script: `backend/synthesize.py`.~~ DONE & RUN.
   Retrieves a per-topic cluster from Discovery Engine, calls Gemini
   (`gemini-2.5-flash`) with a structured `response_schema`, assembles the full
   Story object (metadata + grounded source list from the retrieved docs), and
   uploads to `gs://scope-news-raw-data/synthesized/`. Added `google-genai`.
   Verified: produced 5 lens stories via the Gemini Developer API key path
   (Vertex Gemini access is not granted on `scope-mvp-prod` yet — see `LESSONS.md`).

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

6. ~~Run the committed `synthesize.py` in Cloud Shell.~~ DONE — see Task 3.
   Cleanup left: an earlier ad-hoc script wrote
   `gs://scope-news-raw-data/synthesized/20260627T124918Z.json` with a WRONG flat
   schema (query/summary/articles, no lenses). Delete it, or have the frontend
   loader match `stories_*.json` only.

7. **NEXT** — Connect the Next.js frontend to the cached synthesized JSON. Add a
   data-access layer / API route that reads the latest `synthesized/stories_*.json`
   from GCS and swap it in for `lib/mock-data.ts`. The Story shape already matches,
   so the UI should not need changes. Start by validating one `stories_*.json`
   against `Story` / `TriPerspectiveLens`. Known gap: `synthesize.py` emits
   placeholder `biasLean: "center"` / `reliability: 75` for every source (curated
   outlet-bias dataset is deferred), so the bias spectrum/badges will look uniform.

8. Build grounded chat behavior using only loaded/retrieved article context
   (replace `lib/mock-chat.ts` with a real grounded route).

9. Add deployment and refresh documentation.

## Deferred Tasks

- Add fallback source chain beyond RSS: GNews, NewsData, GDELT (multi-feed RSS
  across BBC/CNBC/Guardian is already in `ingest.py`).
- Curated outlet-bias dataset (real `biasLean` / `reliability`) to replace the
  placeholder source values in `synthesize.py`.
- Real cross-source same-story clustering (currently one TOPIC query = one cluster).
- Get Vertex AI Gemini access granted on `scope-mvp-prod` so synthesis can move off
  the Developer API key onto ADC.
- Add Cloud Scheduler / Cloud Function or Cloud Run job for scheduled ingestion.
- Add LLM-as-judge validation loop.
- Add Vercel deployment configuration.
- Add production service account with least-privilege IAM.
