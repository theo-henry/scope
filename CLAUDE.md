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
feedparser
```

Current ingestion source:

```text
http://feeds.bbci.co.uk/news/world/rss.xml
```

Current script behavior:

- Fetches top 10 BBC World RSS articles.
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
gs://scope-news-raw-data/raw/bbc_world_20260627T095745Z.json
gs://scope-news-raw-data/agent-search/bbc_world_20260627T095745Z.ndjson
```

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
- Imported documents: `10`
- Verified search query: `BBC news`

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

Not started yet.

Planned model layer:

- Model family: Gemini
- PRD target: Gemini 1.5 Flash
- Purpose: synthesize retrieved article clusters into Scope's Tri-Perspective Lens JSON.

The Gemini synthesis script must not run until Discovery Engine retrieval has been verified.

## Frontend

There is already a frontend folder:

```text
scope-news-reader/
```

The frontend appears to be a Next.js app with Tailwind/shadcn-style structure. It should later consume cached synthesized JSON rather than directly querying RSS, Discovery Engine, or Gemini from the browser.

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
