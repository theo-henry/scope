# Scope

**Scope is a daily news curator that reads the same story across many outlets and rewrites it as three distinct analytical lenses** — so you can see not just *what* happened, but *how differently it's being framed*.

For every story, Scope generates:

1. **Institutional / Neutral Synthesis** — the consensus account, stripped of spin.
2. **Reformist / Divergence** — where coverage disagrees, and what the challengers argue.
3. **Skeptic / Bias & Validity** — what to distrust: weak sourcing, loaded framing, missing context.

The goal is media literacy by construction. Instead of reading one outlet and absorbing its bias, you read one *synthesis* that makes the disagreement itself the subject.

> This project was built for a Generative AI class. The sections below flag **🤖 where and how generative AI does the work** — it is the core of the product, not a bolt-on.

---

## Where generative AI is used

Generative AI (Google's **Gemini** models) is responsible for everything that turns raw news feeds into Scope's content. There are four distinct GenAI tasks:

| # | Task | Model | What it does |
|---|------|-------|--------------|
| 1 | **Tri-Perspective synthesis** | `gemini-2.5-flash` | Reads a cluster of articles about one event from many outlets and writes the three lenses. A strict JSON schema (`response_schema`) forces the output to match the frontend's data contract exactly, so the model can't break the UI. |
| 2 | **Story classification** | `gemini-2.5-flash` | The same call also tags each story with its topic categories (Politics, Tech/AI, Markets, …) and the countries it concerns, constrained to a fixed enum. These tags power the app's filters. |
| 3 | **Editorial image generation** | `gemini-3.1-flash-image` | Generates one clean 16:9 editorial illustration per story (no text, no logos, no recognizable public figures) used as the story's artwork. |
| 4 | **Grounded chat** | `gemini-2.5-flash` | A per-story chat assistant that answers **only** from the retrieved synthesized stories and cites its sources. It is prompt-constrained to refuse anything it can't ground in the loaded context — a deliberate guard against hallucination. |

A key design choice: **the app never calls a model in the browser.** All synthesis runs ahead of time in a backend pipeline and is cached as JSON. The frontend just displays precomputed content. The only live model call is the chat assistant, which runs server-side on demand.

---

## How the pipeline works

Scope is a decoupled, cloud-native pipeline. Each stage hands off to the next through Google Cloud Storage, so the slow/expensive AI work is fully separated from the fast user-facing site.

```
  RSS / free news feeds (~80 outlets, all categories & regions)
        │
        ▼
  ingest.py ─────────────► fetches articles, normalizes them,
        │                  uploads raw + indexable files to Cloud Storage
        ▼
  Discovery Engine ──────► indexes the articles so they can be
  (Agent Search)           retrieved by semantic search
        │
        ▼
  synthesize.py ─────────► 🤖 retrieves clusters of related articles,
        │                  asks Gemini to write the 3 lenses + tags + image,
        │                  dedupes/merges events, writes synthesized JSON
        ▼
  Cloud Storage ─────────► synthesized/latest.json  (the cached "brief")
        │
        ▼
  Next.js frontend ──────► reads latest.json, renders the swipeable feed.
                           🤖 chat panel answers questions, grounded + cited.
```

**Why a retrieval step at all?** Pulling articles into a search index first means synthesis works on *clusters of independent coverage of the same event* rather than a single feed. That cross-outlet overlap is exactly what makes the three-lens comparison possible — and it's a small RAG (retrieval-augmented generation) setup: retrieve relevant documents, then feed them to the model as grounded context.

---

## Repository structure

```
scope/
├── backend/                  Python data + AI pipeline
│   ├── sources.json          catalog of ~80 RSS feeds (the inputs)
│   ├── ingest.py             fetch feeds → normalize → upload to Cloud Storage
│   ├── synthesize.py         🤖 retrieve clusters → Gemini synthesis → cached JSON
│   ├── refresh.py            orchestrates ingest → index import → synthesize
│   ├── outlet_bias.json      static left/center/right ratings per outlet
│   └── evaluate.py           quality checks on generated output
│
├── scope-news-reader/        Next.js (App Router) frontend
│   ├── app/                  pages (feed, story, onboarding, settings)
│   │   └── api/chat/route.ts 🤖 server-side grounded chat endpoint
│   ├── components/           UI (feed cards, lens sections, chatbot, …)
│   └── lib/                  data fetching, types, retrieval helpers
│       ├── types.ts          the Story / TriPerspectiveLens contract
│       ├── stories.ts        fetches synthesized/latest.json (hourly ISR)
│       └── chat-retrieval.ts local keyword retrieval for the chat assistant
│
├── CLAUDE.md / TASKS.md      engineering handoff & task notes
├── LESSONS.md                things learned the hard way (e.g. retrieval tuning)
├── PRD.md / DESIGN.md        product requirements & design spec
└── README.md                 you are here
```

### The backend ↔ frontend contract

The single most important interface in the project is the shape of a story. `LENS_RESPONSE_SCHEMA` in `backend/synthesize.py` (the schema Gemini is forced to fill) mirrors `Story` / `TriPerspectiveLens` in `scope-news-reader/lib/types.ts` (the shape the UI reads). Keeping these two in sync is what guarantees the AI output always renders correctly.

---

## The frontend experience

- **Daily brief** — a focused set of essential stories, presented as a swipeable horizontal feed.
- **Per-story coverage view** — the three lenses as numbered sections, plus the spread of sources and their bias ratings.
- **Filters** — by topic category and country, driven by the AI-assigned tags.
- **🤖 Chat overlay** — ask follow-up questions about a story; answers come only from the loaded articles and are cited.
- **Onboarding & settings** — a demo profile lets you pick interests; no real auth in this version.

The design follows an NYT-clean aesthetic: serif headlines, generous whitespace, restrained accent color. See `DESIGN.md` for the full spec.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| **Generative AI** | Google Gemini (`gemini-2.5-flash` for text, `gemini-3.1-flash-image` for artwork) |
| **Retrieval / RAG** | Google Cloud Discovery Engine (Agent Search) |
| **Storage / pipeline** | Google Cloud Storage |
| **Backend** | Python (`feedparser`, `google-genai`, `google-cloud-*`) |
| **Frontend** | Next.js (App Router), TypeScript, Tailwind / shadcn-style components |
| **Hosting** | Vercel (frontend), reading the cached JSON from Cloud Storage |

---

## Running it locally

The frontend is the interesting part to see; it reads the already-generated brief from Cloud Storage, so you don't need the backend or any cloud access to run it.

```bash
cd scope-news-reader
pnpm install
cp .env.local.example .env.local   # add a Gemini API key to enable the chat panel
pnpm dev
```

Then open <http://localhost:3000>.

The backend pipeline (`ingest.py` → Discovery Engine import → `synthesize.py`, or all three via `refresh.py`) regenerates the cached brief and requires access to the `scope-mvp-prod` Google Cloud project. Engineering details for that live in `CLAUDE.md`.
