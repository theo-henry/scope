# Product Requirements Document: Scope

## 1. App Overview & Executive Summary

**Scope** is a news reader and AI-powered daily curator designed to combat information overload, media bias, and fragmented news consumption. It shows readers not just *what* happened, but *who is saying what about it* and *how much to trust it*. Built as a decoupled, cloud-native application, Scope delivers a hyper-focused morning brief consisting of exactly five essential news stories tailored to a user's chosen topics and regional interests.

Rather than overwhelming users with endless vertical feeds, Scope presents each story as a single, distraction-free card broken down into three distinct analytical lenses synthesized by Generative AI. The application architecture utilizes an asynchronous ingestion strategy that completely isolates the client from third-party API limitations and token latency. By leveraging Google Cloud Platform (GCP) infrastructure, specifically Discovery Engine / Agent Search and Gemini 1.5 Flash on Vertex AI, Scope implements a robust, production-ready Retrieval-Augmented Generation (RAG) framework.

## 2. Core User Experience & UI Flow

* **Preference Profile:** A simple onboarding surface where the user sets preferences for geographic regions and flagship topics (e.g., Finance, Markets, Politics, Tech/AI). Version 1 ships with a single pre-set demo profile.
* **The Daily 5-Card Journey:** Once configured, the app launches directly into the day's brief. The interface is strictly limited to one page per news story. Users review a story and its outlooks, then swipe horizontally to uncover the next piece of news.
* **The Tri-Perspective Lens (Coverage View):** Each of the five main stories surfaces the same event across 5 to 8 outlets, rendered with three structured sub-sections powered by the GenAI pipeline:
  * *Lens 1 (Institutional/Neutral Synthesis):* Focuses on official statements, government actions, regulatory bodies, and established economic consensus.
  * *Lens 2 (Reformist/Divergence):* Focuses on market disruptions, public/labor reactions, and alternative economic interpretations. Marks where sources agree and diverge.
  * *Lens 3 (Skeptic/Bias & Validity):* Highlights speculative claims, missing data, or explicit narrative divergence. Attaches a bias label to outlets and a validity score based on corroboration.
* **Historical Archive:** Once the user finishes swiping through their top five stories, they can scroll vertically downward to reveal a clean, reverse-chronological archive of cards from previous days.
* **Grounded Chat Overlay:** A minimalist, slide-in chat panel accessible on each card. A grounded in-site chatbot answers questions using *only* the loaded articles and cites its sources, preventing AI hallucinations.

## 3. Business Model & Value Proposition

* **Target Market:** High-earning professionals (e.g., Financial Analysts, Strategy Consultants, and Policy Advisors) who need a fast, low-noise morning read.
* **The Problem:** Professionals spend an average of 45 minutes every morning jumping between multiple international news platforms to cross-reference geopolitical events and spot narrative biases, resulting in cognitive fatigue and lost billable hours.
* **Value Proposition (ROI):** Scope condenses cross-border narrative synthesis into a 5-minute daily horizontal swipe session.
  * *Daily Financial Savings per User = 0.66 hours × $150 blended billable rate = $100 saved per day.*
* **Monetization Strategy:**
  * *B2C Freemium:* Free tier access to a general global politics feed. Premium tier subscription ($15/month) unlocks customized region filtering and specialized B2B vertical sectors (e.g., Tech/AI, Markets).
  * *B2B Enterprise:* Dedicated workspace instances with proprietary internal data ingestion capabilities.

## 4. End-to-End Technical Architecture

The system decouples data aggregation from user consumption by executing data ingestion, embedding, clustering, and LLM synthesis in an automated background pipeline.

    [ Free API / RSS Chain ] ---> [ Python / Cloud Function Ingestion ] ---> [ Google Cloud Storage (GCS) ]
                                                                                    |
    [ Vercel Frontend ] <--- [ Cached Tri-Perspective JSON ] <--- [ Gemini 1.5 ] <-- [ Discovery Engine / Agent Search ]

* **Data Ingestion (Zero-Cost Engine):** A scheduled cloud function automatically polls a fallback chain of free developer tiers, prioritizing GNews, NewsData, and The Guardian Open Platform, anchoring against GDELT. GDELT provides an unlimited, free stream of global news metadata without requiring API keys. Raw JSON payloads are dumped directly into a Google Cloud Storage (GCS) landing bucket.
* **Same-Story Clustering & Vectorization (Discovery Engine / Agent Search):** Discovery Engine / Agent Search is linked directly to the GCS bucket. It handles document chunking, generates high-fidelity vector embeddings natively, and manages the internal vector search index. Articles covering identical real-world events are retrieved and grouped into clusters (5 to 8 outlets per story).
* **GenAI Synthesis Pipeline (Gemini 1.5 Flash):** The backend passes the aggregated text chunks from the top 5 article clusters into Gemini 1.5 Flash. The prompt enforces a strict JSON schema output mapping directly to the Tri-Perspective Lens.
* **Frontend Delivery:** Built using Next.js (App Router), Tailwind CSS, and shadcn/ui. Deployed onto Vercel. It reads entirely from a pre-processed data cache, ensuring user requests never trigger live AI generation on page load. Model and cloud credentials are used only by trusted backend jobs or server-side code and never appear in the client.

## 5. Model Choice & Framework Justification

* **RAG vs. Fine-Tuning:** A Retrieval-Augmented Generation (RAG) pattern was chosen over Fine-Tuning. Global news changes dynamically by the hour; RAG allows the injection of real-time knowledge directly into the context window at query time without continuous retraining.
* **Discovery Engine / Agent Search vs. Custom Vector Databases:** Utilizing a fully managed Google Cloud retrieval service removes the technical debt of manually tuning vector similarity thresholds or managing index sharding, guaranteeing enterprise-grade extraction latency.
* **Gemini 1.5 Flash vs. Heavy Foundation Models:** Gemini 1.5 Flash provides high execution speed and cost-efficient processing of overlapping multi-source texts. Its native handling of structured JSON objects prevents schema breakage during frontend rendering.
* **Single-Agent vs. Multi-Agent Orchestration:** To comply with tight serverless execution limits and avoid the risk of infinite reasoning loops, the system implements a single-agent deterministic workflow.

## 6. Token Cost & Sustainability Calculations

Because the pipeline is decoupled from user interactions, the system processes the top 5 stories exactly *once per day per categorical profile*.

* **Constants:** Gemini 1.5 Flash Input Cost = $0.075 / 1M tokens. Output Cost = $0.30 / 1M tokens.
* **Cluster Size:** 1 Core Story = 6 aggregated source articles × 330 tokens = 1,980 input tokens.
* **Output Size:** Structured JSON payload ≈ 600 output tokens.
* **Cost per Generated Story:** (1,980 / 1,000,000 × $0.075) + (600 / 1,000,000 × $0.30) = $0.0003285
* **Total Daily Pipeline Cost:** 5 stories × $0.0003285 = **$0.0016425 per profile segment per day.**

Regardless of user scaling, the daily AI generation cost remains completely static at a fraction of a cent.

## 7. Evaluation Metrics & Guardrails (LLM-as-Judge)

An automated verification loop runs prior to saving payloads to the production cache to protect against hallucinations.

* **Faithfulness and Grounding Check:** An independent evaluation prompt analyzes the generated lenses against the original GCS raw texts. If any factual statement cannot be mapped to a source article, the card is quarantined.
* **Perspective Variance Metric:** An automated script evaluates whether the linguistic distance and tone of Lens 1 (Institutional) and Lens 2 (Reformist) are sufficiently distinct (Variance ≥ 1.5 scale units).
* **The Cite-or-Abstain Chat Guardrail:** The grounded chatbot panel utilizes native Vertex AI grounding. The model is programmatically restricted from accessing general training data and must output a predefined fallback statement if the answer is missing from the source texts.

## 8. UI Design Rules

* **Aesthetic:** New York Times-clean. Serif headlines, generous whitespace, modernized with a single cool accent and restrained gradients.
* **Layout:** No traditional sidebars. Content lives in center-constrained reading surfaces.
* **Indicators:** Validity colors limited to a green/amber/red trio so color stays meaningful, not decorative.

## 9. Out of Scope for v1

* Real multi-user auth and account creation (demo profile only; production auth is deferred to v1.1 and must align with the Google Cloud-based architecture).
* Scraping full article bodies from arbitrary sites (relying on feed metadata/snippets).
* Native mobile app.
* Paid news-API tiers and fine-tuning.
* Push notifications, saved articles, comments, or social features.
* Real-time websocket updates (refresh is manual/triggered).

## 10. Definition of Done

* A reader with the demo profile sees a feed limited to their categories and countries, newest first.
* Every feed card shows a headline, one-line AI summary, source count, and validity pill.
* The coverage view renders for any story with ≥2 outlets: neutral synthesis, per-outlet bias badges, agreement/divergence, and a validity score with a stated rationale.
* The news-API fallback chain demonstrably fails over when one source is rate-limited, and GDELT keeps the app populated with no key.
* The chatbot answers from loaded articles only, cites sources, and declines when the answer isn't in them.
* Refresh runs the full fetch to cluster to synthesize to persist pipeline and updates the feed without manual data entry.
* The app deploys on Vercel and runs the full primary journey (Onboarding to Feed to Coverage to Chatbot) without a hard error.
