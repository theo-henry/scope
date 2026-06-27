# Product Requirement Document: Scope

## 1. Executive Summary
**Scope** is an AI-powered daily news curator designed to combat information overload, media bias, and fragmented news consumption. Built as a decoupled, cloud-native application, Scope delivers a hyper-focused morning brief consisting of exactly five essential news stories tailored to a user's chosen topics and regional interests. Rather than overwhelming users with endless vertical feeds, Scope presents each story as a single, distraction-free card broken down into three distinct analytical lenses synthesized by Generative AI. 

The application architecture utilizes an asynchronous ingestion strategy that completely isolates the client from third-party API limitations and token latency. By leveraging Google Cloud Platform (GCP) infrastructure, specifically Vertex AI Agent Builder and Gemini 1.5 Flash, Scope implements a robust, production-ready Retrieval-Augmented Generation (RAG) framework.

---

## 2. Core User Experience & UI Flow
The frontend prioritizes a clean, high-end editorial aesthetic featuring serif headlines, generous white space, and a modernized, single cool accent color to keep visual data meaningful.

* **Onboarding and Preferences:** A simple landing surface where the user selects their geographic regions and flagship topics (e.g., Finance, Markets, Politics, Tech/AI).
* **The Daily 5-Card Journey:** Once configured, the app launches directly into the day's brief. The interface is strictly limited to one page per news story. Users review a story and its three outlooks, then swipe horizontally to uncover the next piece of news.
* **The Tri-Perspective Lens:** Each of the five main stories is rendered with three structured sub-sections powered by the GenAI pipeline:
  * *Lens 1 (The Institutional Viewpoint):* Focuses on official statements, government actions, regulatory bodies, and established economic consensus.
  * *Lens 2 (The Reformist Viewpoint):* Focuses on market disruptions, public/labor reactions, civil society sentiment, and alternative economic interpretations.
  * *Lens 3 (The Skeptic Viewpoint):* Highlights speculative claims, missing data, or explicit narrative divergence where global sources directly clash.
* **Historical Archive:** Once the user finishes swiping through their top five stories for the day, they can scroll vertically downward to reveal a clean, reverse-chronological archive of cards from previous days.
* **Grounded Chat Overlay:** A minimalist, slide-in chat panel accessible on each card. Users can ask deep-dive questions restricted strictly to the articles loaded for that specific story cluster, preventing AI hallucinations through a strict cite-or-abstain guardrail.

---

## 3. Business Model & Value Proposition

### A. Problem Statement & Target Market
High-earning professionals (e.g., Financial Analysts, Strategy Consultants, and Policy Advisors) spend an average of 45 minutes every morning jumping between multiple international news platforms to cross-reference geopolitical events and spot narrative biases. This creates cognitive fatigue and represents a direct loss of billable hours.

### B. Value Proposition & ROI Calculations
Scope condenses cross-border narrative synthesis into a 5-minute daily horizontal swipe session, saving 40 minutes per day per employee.

$$\text{Daily Financial Savings per User} = 0.66 \text{ hours} \times \$150 \text{ blended billable rate} = \$100 \text{ saved per day}$$

### C. Monetization Strategy
* **B2C Freemium:** Free tier access to a general global politics feed. Premium tier subscription ($15 per month) unlocks customized region filtering and specialized B2B vertical sectors (e.g., Tech/AI, Markets, Commodities).
* **B2B Enterprise:** Dedicated workspace instances with proprietary internal data ingestion capabilities.

---

## 4. End-to-End Technical Architecture

The system decouples data aggregation from user consumption by executing data ingestion, embedding, clustering, and LLM synthesis in an automated background pipeline.