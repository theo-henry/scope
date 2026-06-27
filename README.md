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

The pipeline is currently manual. Run these steps in order whenever you want fresh stories:

```bash
# 1. Ingest new articles
backend/venv/bin/python backend/ingest.py

# 2. Import into Discovery Engine (do this in the GCP Console or via SDK)
#    Go to: console.cloud.google.com/gen-app-builder → scope-news-search → Import

# 3. Synthesize
export GEMINI_API_KEY="..."
export SCOPE_DATA_STORE_ID="scope-news-raw-datastore"
export SCOPE_SEARCH_ENGINE_ID="scope-news-search"
backend/venv/bin/python backend/synthesize.py
```

`latest.json` is overwritten automatically. The live site picks it up within one hour.

---

## Environment variables reference

### Frontend (`scope-news-reader/.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Gemini Developer API key for the `/api/chat` route |
| `SCOPE_STORIES_URL` | No | GCS public URL | Override where the frontend fetches story data |
| `SCOPE_GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model used by the chat route |

### Backend (shell exports before running scripts)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Used by `synthesize.py` |
| `SCOPE_DATA_STORE_ID` | Yes | — | Discovery Engine data store ID |
| `SCOPE_SEARCH_ENGINE_ID` | No | — | Discovery Engine search app ID |
| `SCOPE_PROJECT_ID` | No | `scope-mvp-prod` | GCP project ID |
| `SCOPE_GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model used by synthesis |

---

## GCP resources

| Resource | ID |
|----------|----|
| GCP Project | `scope-mvp-prod` |
| GCS Bucket | `scope-news-raw-data` |
| Discovery Engine data store | `scope-news-raw-datastore` |
| Discovery Engine search app | `scope-news-search` |
| Synthesized cache (public) | `gs://scope-news-raw-data/synthesized/latest.json` |
