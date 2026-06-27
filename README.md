# Scope

A daily news curator that synthesizes stories from multiple outlets into three analytical lenses: Institutional (neutral synthesis), Reformist (divergence), and Skeptic (bias & validity).

## How the pipeline works

```
RSS feeds (BBC, CNBC, Guardian)
  → backend/ingest.py          fetches articles, uploads to GCS
  → Discovery Engine           indexes the articles, enables search
  → backend/synthesize.py      retrieves clusters, calls Gemini, writes synthesized JSON
  → GCS synthesized/latest.json
  → Next.js frontend           fetches latest.json at build time (hourly ISR)
```

The frontend never calls RSS, Discovery Engine, or Gemini directly. It reads a precomputed JSON file.

---

## Prerequisites

| Tool | What it is | Install |
|------|-----------|---------|
| `gcloud` CLI | Google Cloud command-line tool | [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install) |
| Python 3.11+ | Backend runtime | [python.org](https://python.org) |
| Node.js 20+ | Frontend runtime | [nodejs.org](https://nodejs.org) |
| `pnpm` | Frontend package manager | `npm install -g pnpm` |

You also need:
- A Google account with IAM access to `scope-mvp-prod`
- A Gemini API key from [aistudio.google.com](https://aistudio.google.com)

---

## Local development

### 1. Authenticate with Google Cloud

```bash
gcloud auth application-default login
gcloud config set project scope-mvp-prod
gcloud auth application-default set-quota-project scope-mvp-prod
```

### 2. Set up the backend

```bash
python -m venv backend/venv
backend/venv/bin/pip install -r backend/requirements.txt
```

### 3. Run ingestion (uploads articles to GCS)

```bash
backend/venv/bin/python backend/ingest.py
```

After this, trigger an incremental import in Discovery Engine so the new articles are searchable. Go to [console.cloud.google.com/gen-app-builder](https://console.cloud.google.com/gen-app-builder), select `scope-news-search`, and import from `gs://scope-news-raw-data/agent-search/*.ndjson`.

### 4. Run synthesis (calls Gemini, writes latest.json to GCS)

```bash
export GEMINI_API_KEY="your-key-here"
export SCOPE_DATA_STORE_ID="scope-news-raw-datastore"
export SCOPE_SEARCH_ENGINE_ID="scope-news-search"

backend/venv/bin/python backend/synthesize.py
```

This overwrites `gs://scope-news-raw-data/synthesized/latest.json` with 5 fresh stories.

### 5. Run the frontend

```bash
cd scope-news-reader
pnpm install
```

Create `scope-news-reader/.env.local`:

```
GEMINI_API_KEY=your-key-here
```

Then start the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app fetches `latest.json` from GCS at startup. The chat panel on each story page sends questions to `/api/chat`, which calls Gemini and returns grounded answers with source citations.

---

## Deploying to Vercel

Vercel is the recommended hosting platform for Next.js. The free tier is sufficient for this project.

### 1. Push the repo to GitHub

Make sure `scope-news-reader/` is committed and pushed.

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import your GitHub repository
4. Set **Root Directory** to `scope-news-reader`
5. Framework preset will auto-detect as **Next.js**

### 3. Set environment variables

In the Vercel project settings under **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `GEMINI_API_KEY` | Your Gemini Developer API key |
| `SCOPE_STORIES_URL` | `https://storage.googleapis.com/scope-news-raw-data/synthesized/latest.json` |

### 4. Deploy

Click **Deploy**. Vercel builds and hosts the app. Every subsequent push to `main` triggers a new deploy automatically.

The frontend revalidates `latest.json` every hour (ISR), so new synthesis runs appear without a redeploy.

---

## Refreshing data

Use the refresh script whenever you want fresh stories:

```bash
export SCOPE_PROJECT_ID="scope-mvp-prod"
export SCOPE_DATA_STORE_ID="scope-news-raw-datastore"
export SCOPE_SEARCH_ENGINE_ID="scope-news-search"

# Use one of these auth paths:
export SCOPE_GEMINI_SECRET_ID="scope-gemini-api-key"
# or, for local/manual testing:
# read -rsp "Gemini API key: " GEMINI_API_KEY && echo && export GEMINI_API_KEY

backend/venv/bin/python backend/refresh.py
```

`refresh.py` fetches RSS articles, uploads raw + NDJSON files to GCS, triggers the
Discovery Engine incremental import, waits briefly for indexing, then runs
synthesis and image generation.

`latest.json` is updated automatically. The live site picks it up within one hour.
Older stories are retained for 14 days by default, capped at 50 visible stories.
Existing stories are reused when the retrieved source cluster has the same
`sourceKey`, so unchanged story clusters do not call Gemini again or regenerate
their images.

For a no-publish check before scheduling, run:

```bash
SCOPE_REFRESH_DRY_RUN=true backend/venv/bin/python backend/refresh.py
```

Dry runs still fetch/import current RSS articles and upload a refresh report, but
they do not call Gemini or overwrite `synthesized/latest.json`.

---

## Environment variables reference

### Frontend (`scope-news-reader/.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Gemini Developer API key for the `/api/chat` route |
| `SCOPE_STORIES_URL` | No | GCS public URL | Override where the frontend fetches story data |
| `SCOPE_GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model used by the chat route |

### Backend (shell exports before running scripts)

The shared Gemini key is stored in Secret Manager as `scope-gemini-api-key`.
Prefer `SCOPE_GEMINI_SECRET_ID=scope-gemini-api-key` for synthesis runs; use a
direct `GEMINI_API_KEY` only for short-lived local testing.
For local testing, `backend/synthesize.py` also reads a repo-root `.env` file
before it reads environment variables. `.env` is gitignored.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Yes* | — | Used by `synthesize.py` for story text and image generation |
| `SCOPE_GEMINI_SECRET_ID` | No | — | Secret Manager secret name or resource path for the Gemini key; used when no key env var is set |
| `SCOPE_DATA_STORE_ID` | Yes | — | Discovery Engine data store ID |
| `SCOPE_SEARCH_ENGINE_ID` | No | — | Discovery Engine search app ID |
| `SCOPE_PROJECT_ID` | No | `scope-mvp-prod` | GCP project ID |
| `SCOPE_GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model used by synthesis |
| `SCOPE_GEMINI_IMAGE_MODEL` | No | `gemini-3.1-flash-image` | Gemini image model used for generated story artwork |
| `SCOPE_SOURCE_CATALOG` | No | `backend/sources.json` | JSON source catalog used by ingestion |
| `SCOPE_PER_FEED_LIMIT` | No | `12` | Maximum RSS entries fetched from each source |
| `SCOPE_MIN_DOMAINS` | No | `3` | Minimum distinct source domains required for synthesis |
| `SCOPE_MIN_DOMAINS_EXCEPTION_CATEGORIES` | No | `Tech/AI,Markets` | Categories allowed to use lower domain threshold |
| `SCOPE_EXCEPTION_MIN_DOMAINS` | No | `2` | Minimum domains for exception categories |
| `SCOPE_MAX_DOMAIN_SHARE` | No | `0.6` | Maximum share of recent retrieved docs allowed from one domain |
| `SCOPE_MAX_NEW_CLUSTERS` | No | `10` | Maximum selected candidate clusters per refresh |
| `SCOPE_REFRESH_DRY_RUN` | No | `false` | If true, write a report without Gemini calls or `latest.json` updates |
| `SCOPE_IMAGE_PREFIX` | No | `story-images` | GCS prefix for generated story images |
| `SCOPE_STORY_RETENTION_DAYS` | No | `14` | Number of days old stories remain visible in `latest.json` |
| `SCOPE_MAX_STORIES` | No | `50` | Maximum visible stories retained in `latest.json` |
| `SCOPE_CLUSTER_DOC_MAX_AGE_DAYS` | No | `14` | Maximum age of ingested documents considered for new/reused clusters |
| `SCOPE_INDEX_SETTLE_SECONDS` | No | `120` | Refresh delay after Discovery Engine import before synthesis |
| `SCOPE_IMPORT_TIMEOUT_SECONDS` | No | `900` | Timeout for the Discovery Engine import operation |

*Required unless `SCOPE_GEMINI_SECRET_ID` is configured and the runtime has Secret Manager access.

---

## GCP resources

| Resource | ID |
|----------|----|
| GCP Project | `scope-mvp-prod` |
| GCS Bucket | `scope-news-raw-data` |
| Discovery Engine data store | `scope-news-raw-datastore` |
| Discovery Engine search app | `scope-news-search` |
| Synthesized cache (public) | `gs://scope-news-raw-data/synthesized/latest.json` |
| Generated story images (public) | `gs://scope-news-raw-data/story-images/` |
