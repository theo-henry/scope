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

## Current Position (as of 2026-06-27, end of session)

Full pipeline live end-to-end:
  ingest.py → GCS → Discovery Engine (123 docs) → synthesize.py → latest.json (public)
  → Next.js frontend (SSG, hourly ISR) → /api/chat (grounded, Gemini REST)

Frontend is live at localhost:3000 reading real GCS data (5 stories, 3 lenses each).
GCS bucket public access is open (allUsers objectViewer on scope-news-raw-data).
evaluate.py is committed and ready to run; has not been executed against live data yet.

**Pending for submission (guidelines.pdf):**
  A. Presentation deck (PDF) — required deliverable, not built yet
  B. Architecture justification — goes in the deck (RAG vs fine-tuning, why Gemini,
     why Discovery Engine, prompt engineering, guardrails)
  C. Quantified value proposition — 2-3 business metrics for the pitch (ROI, time saved)
  D. Run evaluate.py and include scores in the deck as evaluation evidence

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

7. ~~Connect the Next.js frontend to the cached synthesized JSON.~~ DONE (code).
   New `lib/stories.ts` async data layer fetches the public object
   `synthesized/latest.json` server-side (build + hourly ISR) and falls back to the
   committed sample (`lib/mock-data.ts` STORIES) if it's unreachable/invalid.
   `app/page.tsx` and `app/story/[slug]/page.tsx` are now async and read it; the old
   sync getters were removed from `mock-data.ts`. `synthesize.py` now also writes
   `synthesized/latest.json`. Frontend `tsc` + `next build` pass (build currently
   logs a 403 + uses sample data — expected until the two manual steps below).

   REMAINING (manual, your side) to flip to real data:
   a. Rerun the committed `synthesize.py` in Cloud Shell so `synthesized/latest.json`
      is created (the timestamped-only runs predate this change).
   b. Make that object public-read (grant `allUsers` -> `roles/storage.objectViewer`
      on the object, or on the `synthesized/` prefix). Then the app loads it with no
      credentials. Override the URL with `SCOPE_STORIES_URL` if needed (e.g. Vercel).
   Known gap: `synthesize.py` emits placeholder `biasLean: "center"` /
   `reliability: 75` for every source, so the bias spectrum/badges look uniform.

8. ~~Build grounded chat behavior using only loaded/retrieved article context.~~ DONE.
   `app/api/chat/route.ts` — POST `{ question, story }` → builds a structured context
   block from story lenses + sources → calls Gemini REST API (no SDK, no new packages)
   with `response_schema` enforcing `{ answer, citations[] }` → returns `{ text, citations }`.
   `chatbot-panel.tsx` now calls `/api/chat` instead of `mockAnswer`. `mock-chat.ts`
   retains only `Citation` type and `SUGGESTED_QUESTIONS`.
   REMAINING (manual): create `scope-news-reader/.env.local` with `GEMINI_API_KEY=<key>`
   and run `pnpm dev` to smoke-test the chat panel on a live story.

9. ~~Add deployment and refresh documentation.~~ DONE.
   `README.md` now covers: pipeline overview, prerequisites, local dev (backend +
   frontend), Vercel deployment steps, manual data refresh workflow, and a full
   env-var reference table for both frontend and backend.

10. ~~Add LLM-as-a-judge evaluation metrics.~~ DONE.
    `backend/evaluate.py` loads `synthesized/latest.json`, re-retrieves source
    clusters from Discovery Engine per story, and scores each synthesis with Gemini
    on three RAGAS-inspired metrics: faithfulness, lens_distinctiveness, completeness.
    Records per-story judge latency. Saves JSON report to
    `gs://scope-news-raw-data/evaluations/eval_<timestamp>.json` and prints a
    formatted report to stdout. Same env vars as `synthesize.py`.
    Run: `backend/venv/bin/python backend/evaluate.py`
    NOTE: has not been run against live data yet — do this before the presentation
    and include aggregate scores in the deck.

11. ~~UI fixes (this session).~~ DONE.
    - Fixed duplicate React key bug in `source-avatars.tsx` (domain not unique
      when multiple articles from same outlet; now uses index+domain).
    - Added outlet favicon logos: `components/outlet-logo.tsx` — loads from
      Google s2 favicon service, falls back to letter avatar on error. Used in
      `source-avatars.tsx` (feed cards) and `coverage/source-list.tsx` (detail page).
    - Reordered story detail sections: Institutional → Reformist → Skeptic →
      Validity → What's Missing → Sources (split out of single Lens 3 block).

## Pending Tasks (required for submission)

12. Run `backend/evaluate.py` and record scores.
    Prerequisites: GEMINI_API_KEY + SCOPE_DATA_STORE_ID + SCOPE_SEARCH_ENGINE_ID.
    Include the aggregate faithfulness / lens_distinctiveness / completeness scores
    and avg latency in the presentation deck.

13. Build the presentation deck (PDF) — required deliverable.
    Must cover (maps to rubric pillars):
    - Business problem + value proposition with 2-3 quantified metrics
    - Architecture diagram: RSS → ingest → GCS → Discovery Engine → Gemini → frontend
    - Architecture justification: RAG vs fine-tuning; why Gemini 2.5 Flash;
      why Discovery Engine; prompt engineering design; guardrails (cite-or-abstain,
      isStory schema guard, response_schema enforcement)
    - Evaluation results from Task 12 (LLM-as-a-judge scores + latency)
    - Live demo flow (15-min slot: pitch + demo + Q&A)
    Guidelines require: PDF format, 15-minute time limit, all members speak.

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
