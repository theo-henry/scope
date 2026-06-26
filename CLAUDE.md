# CLAUDE.md — Scope

Root context file for the Scope project. Any AI coding agent (Claude Code, Cursor, etc.)
reads this first, before exploring the codebase. It is the source of truth for what we're
building, how the repo is organized, and how the agent should work here — including how to
read code efficiently and how to keep its own memory current.

> Scope of this file: the **project facts** (top half) are also pasted into v0 alongside
> `PRD.md` and `DESIGN.md`. The **working protocol** (bottom half — memory, self-update,
> efficiency) is for coding agents on GitHub; v0 ignores it.

---

## What I'm building

Scope is a news website that uses generative AI to cut through noise and show how trustworthy
a story is. A user sets preferences — news categories (Finance, Markets, Politics, Tech/AI,
World, Business, Science) and countries — and Scope returns only the most recent matching
stories. For any story, Scope surfaces the same event across multiple outlets, produces a
neutral AI synthesis, marks where sources agree and diverge, attaches a bias label to each
outlet, and gives a validity score based on how many independent and credible outlets
corroborate it. A grounded in-site chatbot answers questions using only the loaded articles
and cites its sources. Lead business case: finance/markets news for professionals who need a
fast, low-noise, low-risk morning read; politics is the second flagship vertical.

It is a Ground News–style product with the editorial calm of The New York Times. The brand is
black/white/grey with restrained silver "AI" gradients (see `DESIGN.md`). The defining promise
is **credibility, not volume** — Scope never fabricates news; it synthesizes and cites real
sourced articles.

This is a university Generative AI final project: the grade rewards a real agentic/RAG
backend, a working frontend, end-to-end integration, a clear quantified business value, and a
flawless live demo. Decisions should serve those.

---

## Project status

- **Phase 1 — v0 prototype.** Generate the frontend in v0 (Vercel) from `PRD.md` + `DESIGN.md`.
- **Phase 2 — GitHub build.** Bring the code into this repo and build the real backend pipeline,
  Supabase, and the API fallback chain. This is where coding agents and this protocol apply.
- Auth (Supabase) and multi-user profiles are deferred; v1 runs on a single hardcoded demo
  profile.

---

## Tech stack

- **Framework:** Next.js (App Router) + TypeScript.
- **Styling:** Tailwind CSS + shadcn/ui, themed entirely from the tokens in `DESIGN.md`.
- **Motion:** Framer Motion + Lenis (smooth scroll). Shared constants in `lib/motion.ts`.
- **Backend:** Next.js serverless route handlers (no separate service). Agentic pipeline:
  fetch → cluster same-story articles → synthesize → score validity → persist.
- **Data:** Supabase (Postgres + pgvector) for articles, stories, embeddings, and cache.
- **LLM:** OpenAI via a thin `lib/llm.ts` abstraction (`generate()`, `embed()`), model read
  from env so it can be swapped. Defaults: `gpt-4o-mini`, `text-embedding-3-small`.
- **News data (all free, fallback chain):** GNews → NewsData.io → Currents → GDELT (no key,
  the always-on tail) → The Guardian (full-text anchor).

---

## Repository structure

```
app/
  page.tsx                 # Feed (home)
  onboarding/page.tsx      # Preferences
  story/[slug]/page.tsx    # Coverage view (the hero)
  settings/page.tsx
  api/
    refresh/route.ts       # runs the ingestion pipeline (fetch→cluster→synthesize→persist)
    chat/route.ts          # grounded chatbot (RAG over persisted articles)
components/
  ui/                      # shadcn primitives, restyled to DESIGN.md tokens
  feed/  coverage/  chatbot/
lib/
  llm.ts                   # provider/model abstraction (env-driven)
  news/                    # one adapter per source + the fallback orchestrator
  cluster.ts               # same-story clustering (embeddings + cosine)
  validity.ts              # validity-score formula
  supabase.ts  motion.ts
data/
  outlet-bias.json         # curated static outlet lean + reliability labels
memory/                    # agent memory (see "Memory & learning system")
PRD.md  DESIGN.md  CLAUDE.md  README.md
```

Update this tree in this file whenever the real structure diverges.

---

## Commands

Fill these in once scaffolded; keep them accurate so agents don't guess.

```
npm run dev      # local dev server
npm run build    # production build
npm run lint     # eslint
npm run test     # tests
```

---

## Environment variables (server-side; never exposed to the client)

```
OPENAI_API_KEY            # the model key; swappable
LLM_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small
GNEWS_API_KEY
NEWSDATA_API_KEY
CURRENTS_API_KEY
GUARDIAN_API_KEY
# GDELT needs no key
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # server only
```

---

## Hard constraints (do not violate)

1. **Never fabricate news.** All synthesis is grounded in real fetched articles and cites
   them. The chatbot answers only from loaded sources and says "not in the sources" otherwise.
2. **News APIs must stay free.** Use the fallback chain; never add a paid tier. GDELT is the
   guaranteed tail so the app never runs dry.
3. **Keys are server-side only.** Model and news calls run in route handlers. No key ever
   reaches the client or a `NEXT_PUBLIC_` var.
4. **The demo reads the cache, not live APIs.** Live fetching happens in `api/refresh`; pages
   read persisted data so a rate limit can never break a live demo.
5. **Design = `DESIGN.md`.** Monochrome brand, silver gradients, Switzer font, blur-up motion.
   Color is reserved for the validity signal only.

---

## Code conventions

- TypeScript strict; no `any` without a comment justifying it.
- Components reference design **tokens**, never raw hex.
- Each news source is its own adapter returning the normalized `Article` shape; the
  orchestrator handles failover. Don't special-case sources outside their adapter.
- Keep route handlers thin; put logic in `lib/`.
- Small, single-purpose functions. Prefer reading an existing pattern over inventing a new one.

---

## How to work in this repo (agent protocol)

### Read efficiently — don't burn tokens
1. **Start here, then `memory/`.** This file plus `memory/learnings.md` usually answer "how
   does X work" without opening source.
2. **Search before reading.** Use grep/glob to locate the exact file and line; read targeted
   ranges, not whole directories. Never `cat` a binary or a generated/lock file.
3. **Read the smallest unit that answers the question.** Don't re-read files already in
   context; trust what you've already seen this session.
4. **Reuse patterns.** Before writing a component or adapter, search for a sibling that already
   solves a similar problem and match its shape.
5. **Check `memory/learnings.md` before debugging.** A known gotcha may already be recorded.

### Before writing code
- Confirm the change fits `What I'm building` and the hard constraints.
- Locate where it belongs in the structure above; if it doesn't fit, that's a signal to ask,
  not to invent a new top-level area.

### Keep your own memory current (self-update)
After any task that revealed something durable — a non-obvious decision, an API quirk, a
recurring bug, a convention — **write it down before finishing**. Memory is how the next
session avoids re-learning. Specifically:
- A **decision** (why we chose X over Y) → `memory/decisions.md`.
- A **gotcha / fix / surprising behavior** → `memory/learnings.md`.
- A **new or changed convention** → `memory/conventions.md`.
- A change to stack, structure, commands, or env → update the relevant **section of this file**.

Rules for memory entries: keep them short and factual, one entry per fact, dated, tagged.
Update an existing entry instead of duplicating. Don't record secrets, keys, or anything that
belongs in `.env`. Don't journal routine work — only durable, reusable knowledge.

---

## Memory & learning system

Lives in `memory/`. Plain markdown, append-only logs. Every entry carries a `[tag]` and a
date. Tags starting with `project_` mark durable project facts (stack, API behavior,
architecture) — the `prd-draft` skill reads these as input, so keep them accurate.

**Format (use everywhere):**
```
- [tag] YYYY-MM-DD — one-line fact or decision. Optional second line of detail.
```

**`memory/decisions.md`** — architectural decision log.
```
- [project_arch] 2025-XX-XX — Backend lives in Next.js route handlers, not a separate service,
  for one clean Vercel deploy.
- [project_rag] 2025-XX-XX — RAG over fine-tuning: news changes daily; retrieval keeps answers
  current and prevents fabrication.
```

**`memory/learnings.md`** — gotchas, fixes, API quirks discovered while building.
```
- [project_api] 2025-XX-XX — GNews free tier caps at 100 req/day; orchestrator must fail over
  to NewsData on 429, then Currents, then GDELT.
- [bug] 2025-XX-XX — pgvector cosine needs the embedding normalized before insert; unnormalized
  vectors skewed clustering.
```

**`memory/conventions.md`** — project rules an agent should follow.
```
- [project_style] 2025-XX-XX — Components read tokens from globals.css; raw hex is a review
  failure.
```

When the same lesson would have saved this session time, it belongs in one of these files.

---

## Definition of done for a change

- Fits `What I'm building` and breaks no hard constraint.
- Reuses existing patterns/tokens; no stray hex, no leaked keys.
- `npm run lint` and `npm run build` pass.
- Any durable decision/gotcha/convention is written to `memory/`; this file is updated if the
  stack, structure, commands, or env changed.
