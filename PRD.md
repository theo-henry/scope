# App Plan — Scope

## 1. App Overview

Scope is a news reader that shows you not just *what* happened but *who is saying what about it* and *how much to trust it*. A reader sets preferences — news categories and countries — and Scope returns the most recent matching stories. For any story, Scope surfaces the same event across multiple outlets, then runs an AI pass that produces a neutral synthesis, marks where sources agree and diverge, attaches a bias label to each outlet, and gives a validity score based on how many independent and credible outlets corroborate the story. A grounded in-site chatbot answers questions using only the loaded articles and cites its sources. The lead business case is finance and markets news for professionals who need a fast, low-noise morning read; politics is the second flagship category. The look is New York Times–clean — serif headlines, generous whitespace — modernized with a single cool accent and restrained gradients.

## 2. Key Components

Core components:

- **Preference profile** — category and country selection that filters every feed. v1 ships a single pre-set demo profile; Supabase accounts come later.
- **Personalized feed** — most-recent-first cards limited to the profile's categories and countries.
- **Multi-source coverage view (the hero)** — one event, the same story across 5–8 outlets, AI synthesis, per-outlet bias labels, agreement vs. divergence, and a validity score.
- **Same-story clustering** — groups articles about one event so the coverage view has something to compare.
- **Validity/confidence engine** — a score derived from outlet corroboration count, average outlet reliability, and AI-detected agreement.
- **Grounded chatbot** — answers from currently loaded articles only, cites sources, compares outlets on request.
- **Ingestion + cache layer** — a refresh route fetches from free news APIs and stores articles so the live demo never depends on a live rate-limited call.

Enhancing features: per-outlet bias badge (lean + reliability) from a curated static dataset; "what's missing" note when one side of the political spectrum isn't covering a story; theme toggle.

## 3. App Structure

Screens:

- **Onboarding / Preferences** — pick categories and countries (pre-filled for the demo profile).
- **Feed (home)** — the personalized story list.
- **Coverage view** — single-story breakdown; the demo centerpiece.
- **Chatbot** — grounded assistant, available as a slide-in panel from any screen.
- **Settings** — model/provider info (read-only, env-based), preferences, theme toggle.

Navigation flow: first visit lands on Onboarding → saving preferences routes to Feed. Each Feed card links to its Coverage view. The chatbot panel opens over any screen via a persistent button in the top nav and is seeded with whatever story is currently in view. Settings is reachable from the avatar menu in the top nav. Returning visits skip Onboarding and land on Feed.

## 4. User Interface

**Onboarding:** centered single-column card on a soft gradient. Category multi-select as toggle chips (Finance, Markets, Politics, Tech/AI, World, Business, Science). Country multi-select as a searchable chip list. Primary "Show my feed" button bottom-right of the card.

**Feed:** fixed top nav — Scope wordmark left, category filter pills center, chatbot button and avatar right. Body is a single-column list (max-width ~720px, NYT-style) of story cards. Each card: small category + country tag row, serif headline, one-line AI summary, a row of small source favicons with a "+N outlets" counter, and a validity pill (Low/Medium/High, color-coded). Most recent at top.

**Coverage view:** serif headline and AI neutral synthesis at top. Below, a **validity meter** (0–100 with a one-line rationale) and an **agreement/divergence** two-column block ("All sources agree" vs. "Sources differ on"). Then a **source list**: each row is outlet name, bias badge (lean + reliability dot), article title, and an outbound link. A right-rail (collapsing under the content on mobile) holds the bias-spectrum distribution of the covering outlets.

**Chatbot:** right-side slide-in panel, 380px. Message thread with inline source citations rendered as small numbered chips that link out. Sticky input at bottom with a streaming response indicator.

**Settings:** plain two-column form — preferences left, model/provider status right (shows active model name from env, no key ever displayed). Theme toggle top-right.

## 5. Backend Requirements

A backend is needed and lives entirely inside the v0 Next.js app as serverless API route handlers — no separate service.

**Data store:** Supabase (Postgres + pgvector).

Schema:

- `articles` — id, title, description, content, url, source_name, source_domain, category, country, published_at, image_url, `embedding vector(1536)`, fetched_at.
- `stories` — id, slug, headline, ai_summary, divergence jsonb, validity_score int, created_at.
- `story_articles` — story_id → article_id (many-to-many).
- `outlet_bias` — domain, name, bias_lean, reliability_score, label_source. Seeded from a curated static JSON of ~50 major outlets compiled from public knowledge (the licensed AllSides/MBFC datasets are not used).
- `profiles` (v1.1, when auth lands) — user_id, categories[], countries[]. v1 uses a hardcoded `DEMO_PROFILE` constant.

**Pipeline (agentic orchestration, run by the refresh route):** fetch from the news-API fallback chain → embed each article (OpenAI) → cluster by cosine similarity to group same-story articles (a cluster of ≥2 outlets becomes a story; GDELT's related-article links act as a clustering fallback when embeddings are sparse) → synthesis step writes the neutral summary and divergence points → validity step computes the score from corroboration count + average reliability + AI agreement → persist. The feed and coverage views read persisted data, so the demo is decoupled from live rate limits. A "Refresh" button triggers the pipeline on demand.

**RAG:** retrieval runs over the persisted article embeddings — both for synthesis grounding and for the chatbot, which retrieves the top-k relevant article chunks before answering.

**Auth:** none in v1 (demo profile). Supabase Auth added in v1.1.

## 6. APIs and Libraries

**News APIs (free, fallback chain in this order):** GNews → NewsData.io → Currents → **GDELT** (no key, effectively unlimited — the always-on tail) → The Guardian Open Platform (reliable full-text anchor). The fetch wrapper tries each in order and moves to the next on a rate-limit or error, normalizing every response to the `articles` shape.

**LLM:** OpenAI via a thin `lib/llm.ts` abstraction exposing `generate()` and `embed()`, reading `OPENAI_API_KEY`, `LLM_MODEL`, and `EMBED_MODEL` from server environment variables — so swapping model or provider later is a one-file change. v1 defaults: `gpt-4o-mini` for synthesis/chat, `text-embedding-3-small` for embeddings.

**Framework justification (for the pitch):** RAG over fine-tuning, because news changes daily and a fine-tuned model can't stay current — retrieval pulls fresh articles at query time.

**Libraries:** Next.js App Router, shadcn/ui + Tailwind (both ship with v0), Vercel AI SDK for streaming chat, `@supabase/supabase-js`, OpenAI SDK. Built-in to v0/Vercel: shadcn components, Tailwind tokens, serverless routes, environment-variable management — don't rebuild these.

## 7. Testing Strategy

**Unit:** the news-API fallback chain (simulate a 429 on the primary, assert failover); the response normalizer; the clustering threshold (known same-story set clusters together, unrelated articles don't); the outlet-bias lookup; the validity-score formula.

**Integration:** end-to-end refresh → cluster → synthesize → persist → render a coverage view; chatbot retrieval returns and cites only loaded articles.

**Evaluation & guardrails (rubric-critical):** LLM-as-judge scores synthesis neutrality on a sample; a faithfulness/citation check verifies every chatbot claim maps to a retrieved source (cite-or-abstain guardrail — the model must say "not in the sources" rather than invent); latency budget tracked per pipeline stage. Hallucination mitigation: synthesis and chat prompts are constrained to provided articles only.

**User acceptance scenarios:** (1) a finance reader sees only finance/markets stories for their countries, newest first; (2) opening a story shows ≥3 outlets with bias badges and a validity score; (3) asking the chatbot "how do sources differ on this?" returns a cited comparison; (4) refresh completes and the feed updates without error.

## 8. Platform-Specific Considerations

For v0/Vercel: use shadcn/ui primitives (Card, Badge, Sheet for the chatbot panel, Tabs) rather than custom components. Set `OPENAI_API_KEY` and news-API keys as Vercel environment variables; never expose them client-side — all model and news calls run in route handlers. Respect the serverless function timeout: the heavy synthesis runs in the ingestion route (cached), not on page load, and the chatbot streams via the Vercel AI SDK to stay responsive. Configure `next.config` `images.remotePatterns` to allow remote news thumbnail domains. Design tokens: light mode default with dark mode; serif display face for headlines, sans for body; one cool accent (suggest a deep indigo/blue) carried into low-opacity gradients on hero and onboarding surfaces; validity colors limited to a green/amber/red trio so color stays meaningful, not decorative.

## 9. Out of Scope for v1

- Real multi-user auth and account creation (demo profile only; Supabase Auth is v1.1).
- Scraping full article bodies from arbitrary sites.
- Native mobile app.
- Paid news-API tiers and fine-tuning.
- Push notifications, saved articles, comments, or any social features.
- More than ~7 categories and a short list of countries.
- Real-time websocket updates (refresh is manual/triggered).

## 10. Definition of Done

- A reader with the demo profile sees a feed limited to their categories and countries, newest first.
- Every feed card shows a headline, one-line AI summary, source count, and validity pill.
- The coverage view renders for any story with ≥2 outlets: neutral synthesis, per-outlet bias badges, agreement/divergence, and a validity score with a stated rationale.
- The news-API fallback chain demonstrably fails over when one source is rate-limited, and GDELT keeps the app populated with no key.
- The chatbot answers from loaded articles only, cites sources, and declines when the answer isn't in them.
- Refresh runs the full fetch → cluster → synthesize → persist pipeline and updates the feed without manual data entry.
- Model and API keys are read from server environment variables and never appear in the client.
- The app deploys on Vercel and runs the full primary journey (Onboarding → Feed → Coverage → Chatbot) without a hard error.
