# Scope Cloud Memory

This file is the central handoff document for Scope's cloud architecture, infrastructure state, and integration assumptions. Any agent or engineer taking over this project must read this file first, then read `TASKS.md` and `LESSONS.md` before making changes. Update all three files continuously as the project moves forward.

## Project Identity

- Product name: Scope
- GCP project ID: `scope-mvp-prod`
- Primary region/location for Discovery Engine / Agent Search: `global`
- Raw data bucket: `scope-news-raw-data`
- Current local repository root: `/Users/nicolaswilches/ds/projects/scope`

## Access And Credential Notes

- No private credentials, access tokens, service account keys, or OAuth refresh tokens should be committed to the repository.
- The Gemini Developer API key is stored in Secret Manager as
  `scope-gemini-api-key` in project `scope-mvp-prod`. Do not print or commit the
  value. Backend synthesis should use `SCOPE_GEMINI_SECRET_ID=scope-gemini-api-key`
  unless a short-lived local `GEMINI_API_KEY` override is intentionally exported.
- `backend/synthesize.py` also loads a repo-root `.env` file before reading
  process env vars. `.env` is gitignored and is only for local/manual runs.
- Collaborators must access Google Cloud through their own Google account.
- The project owner/admin must grant collaborators IAM access to `scope-mvp-prod` in Google Cloud Console.
- Minimum likely roles for active setup work:
  - Storage Admin or scoped bucket permissions for `scope-news-raw-data`
  - Discovery Engine Admin for Agent Search / data store setup
  - Vertex AI User or Vertex AI Admin for later Gemini integration
  - Service Usage Viewer if collaborators need to inspect enabled APIs
- Local ADC setup command for each collaborator:

```bash
gcloud auth application-default login
gcloud config set project scope-mvp-prod
gcloud auth application-default set-quota-project scope-mvp-prod
```

## Enabled Cloud Services

The project is expected to use these GCP APIs:

- Cloud Storage: `storage.googleapis.com`
- Discovery Engine / Agent Search: `discoveryengine.googleapis.com`
- Vertex AI / AI Platform: `aiplatform.googleapis.com`

Verification command:

```bash
gcloud services list --enabled \
  --project="scope-mvp-prod" \
  --filter="name:(storage.googleapis.com discoveryengine.googleapis.com aiplatform.googleapis.com)"
```

Cloud context check:

```bash
export PROJECT_ID="scope-mvp-prod"
export LOCATION="global"
export BUCKET_NAME="scope-news-raw-data"

gcloud config set project "$PROJECT_ID"
gcloud storage ls "gs://${BUCKET_NAME}/agent-search/"
```

## Architecture Overview

Scope is a decoupled, cloud-native daily news curator.

Pipeline:

```text
RSS / free news feeds
  -> Python ingestion script
  -> Google Cloud Storage bucket
  -> Discovery Engine / Agent Search data store
  -> Retrieval layer
  -> Vertex AI Gemini synthesis
  -> Cached Tri-Perspective JSON
  -> Next.js frontend
```

Important separation of responsibilities:

- Cloud Storage stores raw and indexable news files.
- Discovery Engine / Agent Search indexes the files and enables retrieval.
- Vertex AI / Gemini generates the final structured story cards after retrieval is working.
- Next.js displays precomputed content; the frontend should not trigger live AI generation on page load.

## Backend Ingestion

Current backend folder:

```text
backend/
  ingest.py
  requirements.txt
  venv/
```

Current dependencies:

```text
google-cloud-storage
google-cloud-discoveryengine
google-genai
feedparser
```

Current ingestion sources are configured in `backend/sources.json`, not hardcoded
in `ingest.py`. Each enabled source has:

```text
name, url, category, country, tier, enabled
```

The catalog currently includes (grouped by the filter coverage it adds):

```text
US / general:      BBC*, CNBC (Top/Finance/Markets/Tech/Business), The Guardian*,
                   NPR, Politico, The Hill, MarketWatch, WSJ, The Verge, TechCrunch,
                   Wired, MIT Technology Review, Fox News, National Review,
                   Washington Times, Reason, Fortune, Business Insider, Forbes,
                   Al Jazeera, Deutsche Welle
United Kingdom:    BBC*, The Guardian*, Sky News (World/Business)
Eurozone:          France 24, Euronews, Politico Europe
China / Asia:      South China Morning Post, Channel NewsAsia
Japan:             The Japan Times
India:             The Hindu, Times of India, The Economic Times Markets
Science:           BBC Science, Ars Technica, ScienceDaily, Nature, NASA,
                   The Guardian Science/Environment
```

Feeds are chosen so the corpus covers every category AND country filter; the
country tag on a source is just its home/region focus (the per-story country is
AI-assigned, see "Story filtering is AI-assigned" below). The original single BBC
World feed matched none of the topics, so every synthesis query returned 0 docs —
see `LESSONS.md`. New domains not yet in `backend/outlet_bias.json` fall back to
center/75 in the bias UI.

Current script behavior:

- Fetches up to `PER_FEED_LIMIT` (12) articles per feed across all sources above.
- Generates a source-agnostic `art-<sha1(link)>` id (stable across runs, so
  re-ingestion upserts rather than duplicates), strips HTML from summaries, and
  dedupes by id across feeds.
- Normalizes each article with:
  - `id`
  - `title`
  - `link`
  - `summary`
  - `published_date`
  - `source`
  - `ingested_at`
- Uploads raw JSON array for audit/debugging.
- Uploads NDJSON for Discovery Engine / Agent Search import.

Current bucket prefixes:

```text
gs://scope-news-raw-data/raw/
gs://scope-news-raw-data/agent-search/
```

Known successful object examples:

```text
gs://scope-news-raw-data/raw/scope_news_20260627T134519Z.json
gs://scope-news-raw-data/agent-search/scope_news_20260627T134519Z.ndjson
```

Earlier single-feed objects (`bbc_world_*`) remain in the bucket and data store;
the `art-*` ids do not collide with the original `bbc-*` ids.

Run ingestion locally:

```bash
backend/venv/bin/python backend/ingest.py
```

## Discovery Engine / Agent Search Setup

Current stage: Discovery Engine / Agent Search retrieval verified.

Console entry point:

```text
https://console.cloud.google.com/gen-app-builder
```

Expected project selector:

```text
scope-mvp-prod
```

Data store settings:

- Product surface: AI Applications / Agent Search
- App type: Search
- Source: Cloud Storage
- Format: structured data / JSON Lines / NDJSON
- GCS import path: `gs://scope-news-raw-data/agent-search/*.ndjson`
- Document ID field: `id`

Created resources:

- Data store display name: `scope-news-raw-datastore`
- Search app display name: `scope-news-search`
- Imported documents: `123` (10 original BBC World + 113 multi-feed, incremental upsert)
- Verified search queries: `BBC news`, plus all `synthesize.py` TOPICS

Re-importing after ingestion: new NDJSON in `gs://scope-news-raw-data/agent-search/`
is NOT searchable until imported into the data store. Trigger an incremental import
with `DocumentServiceClient.import_documents` (data_schema `custom`, `id_field="id"`,
`ReconciliationMode.INCREMENTAL`) against the `default_branch`. Indexing settles in a
few minutes; the relevance filter on this small store is strict, so synthesis queries
must be short and on-topic (see `LESSONS.md`).

`backend/refresh.py` automates this operational path: fetch RSS, upload raw +
NDJSON, run the incremental Discovery Engine import, wait
`SCOPE_INDEX_SETTLE_SECONDS` seconds, then call `synthesize.py`. It uploads a
JSON report under `gs://scope-news-raw-data/refresh-reports/`. Set
`SCOPE_REFRESH_DRY_RUN=true` to fetch/import/report without calling Gemini or
overwriting `synthesized/latest.json`.

Generated IDs:

```text
SCOPE_DATA_STORE_ID=scope-news-raw-datastore
SCOPE_SEARCH_ENGINE_ID=scope-news-search
DISCOVERY_ENGINE_LOCATION=global
```

If the local or Cloud Shell SDK has the Discovery Engine alpha component installed, generated IDs can be listed with:

```bash
gcloud alpha discovery-engine data-stores list \
  --project="scope-mvp-prod" \
  --location="global"

gcloud alpha discovery-engine engines list \
  --project="scope-mvp-prod" \
  --location="global"
```

## Vertex AI / Gemini Setup

Synthesis verified end-to-end: `backend/synthesize.py` produced 5 lens stories to
`gs://scope-news-raw-data/synthesized/stories_20260627T135452Z.json`.

Model layer:

- Model family: Gemini
- Model in use: `gemini-2.5-flash` (`SCOPE_GEMINI_MODEL`, default in code).
  PRD targeted Gemini 1.5 Flash, but 1.5 / 2.0 Flash are no longer served on the
  Gemini Developer API; 2.5 Flash is confirmed working with the project key.
- SDK: `google-genai`. Two auth paths in `build_genai_client()`:
  - Gemini Developer API key (`GEMINI_API_KEY` / `GOOGLE_API_KEY`) — the path that
    works in this project today.
  - Secret Manager (`SCOPE_GEMINI_SECRET_ID`) — optional production path for the
    same API key when running scheduled jobs.
  - Vertex AI via ADC (`genai.Client(vertexai=True, ...)`) — currently returns 404
    for Gemini publisher models on `scope-mvp-prod` (no Vertex Gemini access granted),
    so prefer the API-key path until that changes. See `LESSONS.md`.
- Purpose: synthesize retrieved article clusters into Scope's Tri-Perspective Lens
  JSON and generate one consistent 16:9 editorial image per story.
- Image generation defaults:
  - Model: `gemini-3.1-flash-image` (`SCOPE_GEMINI_IMAGE_MODEL`)
  - Output: 2K JPEG, 16:9, stored under `gs://scope-news-raw-data/story-images/`
  - Prompt style: realistic, simple editorial image, no visible words/logos/UI,
    avoid recognizable public figures, leave headline-safe negative space.

Run (Gemini Developer API key path, as used in Cloud Shell):

```bash
export GEMINI_API_KEY="..."
export SCOPE_DATA_STORE_ID="scope-news-raw-datastore"
export SCOPE_SEARCH_ENGINE_ID="scope-news-search"
backend/venv/bin/python backend/synthesize.py
```

Output: a timestamped archive `synthesized/stories_<timestamp>.json` AND a stable
`synthesized/latest.json` (both arrays of Story objects, each with
`lenses.institutional/reformist/skeptic`, plus optional `image` metadata when
generation succeeds). The frontend reads `latest.json`.

The Tri-Perspective Lens JSON schema is the shared backend↔frontend contract:
`LENS_RESPONSE_SCHEMA` in `backend/synthesize.py` mirrors `Story` / `TriPerspectiveLens`
in `scope-news-reader/lib/types.ts`. Keep them in sync.

Story filtering is AI-assigned. Gemini emits `categories` and `countries` arrays
(enums constrained to `ALLOWED_CATEGORIES` / `ALLOWED_COUNTRIES`, which mirror the
frontend `CATEGORIES` / `COUNTRIES`). The first entry of each is the primary
`category` / `country` used for single-value display; the full arrays drive
filtering. The topic's category/country is only a retrieval hint and is no longer
trusted for labeling (a UK royal-tax story retrieved by a US "tax" query is now
tagged `United Kingdom` by the model). Frontend filters via `storyCategories` /
`storyCountries` in `lib/types.ts` (any-match on both axes), with a fallback to the
single primary value for caches predating these fields.

Story retention:
- `synthesize.py` merges newly generated stories with the existing `latest.json`.
- Defaults: keep stories published in the last 14 days
  (`SCOPE_STORY_RETENTION_DAYS`) and cap visible stories at 50 (`SCOPE_MAX_STORIES`).
- Deduping is by SOURCE-URL OVERLAP, not just the exact `sourceKey` hash. Two
  clusters/stories are the same event when they share ≥ `SCOPE_DEDUPE_MIN_SHARED_URLS`
  (default 2) canonical URLs OR have URL-set Jaccard ≥ `SCOPE_DEDUPE_MIN_JACCARD`
  (default 0.4). This is why different queries (`tax`, `government budget`) no longer
  produce 3 cards for one event.
  - Overlapping candidate clusters are merged (`merge_overlapping_clusters`) into one
    richer cluster before synthesis.
  - A new cluster overlapping an existing story: if it adds no new URLs, the old
    synthesis is REUSED (no Gemini/image cost); if it brings fresh sources, the story
    is RE-SYNTHESIZED and the stale duplicate is superseded (dropped from the cache).
  - `sourceKey` is still a stable hash of topic/category/country + sorted source URLs,
    used as the merge/identity key. Retrieved docs older than
    `SCOPE_CLUSTER_DOC_MAX_AGE_DAYS` are ignored before any of this.
- `synthesize.py` evaluates multiple short candidate queries per category, dedupes
  retrieved docs by source domain, applies quality gates, ranks viable clusters, and
  only synthesizes the top `SCOPE_MAX_NEW_CLUSTERS`.
- Quality defaults: at least 3 distinct domains, except Tech/AI and Markets can
  use 2; skip clusters where one domain exceeds `SCOPE_MAX_DOMAIN_SHARE` of recent
  retrieved docs.
- The end-of-run summary reports accurate buckets — synthesized (incl. re-synthesized
  duplicates), reused, carried-over, and dropped (aged-out / superseded / over-cap).
  The old "N new, M previous" line was misleading: "new" double-counted reused
  stories and "previous" ignored aged-out/superseded drops, so the totals never added
  up to the visible count.

## Frontend

There is already a frontend folder:

```text
scope-news-reader/
```

A Next.js (App Router) app with Tailwind/shadcn-style structure. Story data comes
from `lib/stories.ts`, which fetches the public `synthesized/latest.json`
server-side (build + hourly ISR) and falls back to the committed sample
(`lib/mock-data.ts` STORIES) when it's unreachable/invalid. It never queries RSS,
Discovery Engine, or Gemini from the browser. The chatbot still uses
`lib/mock-chat.ts` (real grounded route is Task 8).

Data source config:
- Default URL: `https://storage.googleapis.com/scope-news-raw-data/synthesized/latest.json`
- Override with `SCOPE_STORIES_URL` (e.g. in Vercel env).
- `latest.json` must be granted public read (`allUsers` -> `storage.objectViewer`)
  for the live data to load; otherwise the app serves the sample fallback.
- Story images are optional in the schema. When present, feed cards render them
  beside the blurb and coverage headers use them as the background image with the
  dark scrim overlay. Old caches without images remain valid.

The coverage view renders the three explicit lenses as numbered sections via
`components/coverage/lens-sections.tsx`, driven by `Story.lenses` in `lib/types.ts`.

## Product Constraints From PRD

- Daily brief should focus on exactly five essential stories.
- Story UI should be swipeable/horizontal.
- Each story should expose a Tri-Perspective Lens:
  - Institutional / Neutral Synthesis
  - Reformist / Divergence
  - Skeptic / Bias & Validity
- Chat overlay must answer only from loaded/retrieved articles and cite sources.
- UI should be minimalist, NYT-clean, serif headlines, generous whitespace, restrained accent color.
- No full article scraping in v1; rely on feed metadata/snippets.
- No real auth in v1; demo profile only.

## Handoff Rule

Before any future work:

1. Read `CLAUDE.md`.
2. Read `TASKS.md`.
3. Read `LESSONS.md`.
4. Update these files whenever infrastructure, code, IDs, assumptions, blockers, or next tasks change.
