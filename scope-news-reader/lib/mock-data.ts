import type { Profile, Source, Story } from './types'

// v1 ships a single hardcoded demo profile. Supabase `profiles` replaces this later.
export const DEMO_PROFILE: Profile = {
  categories: ['Finance', 'Markets', 'Politics', 'Tech/AI', 'World'],
  countries: ['United States', 'United Kingdom', 'Eurozone', 'Global'],
}

// Curated outlet bias/reliability (subset of the future data/outlet-bias.json).
const O = {
  reuters: { outlet: 'Reuters', domain: 'reuters.com', biasLean: 'center', reliability: 95 },
  ap: { outlet: 'Associated Press', domain: 'apnews.com', biasLean: 'center', reliability: 94 },
  bbc: { outlet: 'BBC', domain: 'bbc.com', biasLean: 'center', reliability: 90 },
  ft: { outlet: 'Financial Times', domain: 'ft.com', biasLean: 'center', reliability: 92 },
  wsj: { outlet: 'Wall Street Journal', domain: 'wsj.com', biasLean: 'lean-right', reliability: 89 },
  bloomberg: { outlet: 'Bloomberg', domain: 'bloomberg.com', biasLean: 'center', reliability: 91 },
  cnbc: { outlet: 'CNBC', domain: 'cnbc.com', biasLean: 'center', reliability: 84 },
  nyt: { outlet: 'The New York Times', domain: 'nytimes.com', biasLean: 'lean-left', reliability: 88 },
  guardian: { outlet: 'The Guardian', domain: 'theguardian.com', biasLean: 'lean-left', reliability: 85 },
  wapo: { outlet: 'The Washington Post', domain: 'washingtonpost.com', biasLean: 'lean-left', reliability: 86 },
  foxbiz: { outlet: 'Fox Business', domain: 'foxbusiness.com', biasLean: 'right', reliability: 72 },
  fox: { outlet: 'Fox News', domain: 'foxnews.com', biasLean: 'right', reliability: 70 },
  economist: { outlet: 'The Economist', domain: 'economist.com', biasLean: 'center', reliability: 90 },
  axios: { outlet: 'Axios', domain: 'axios.com', biasLean: 'center', reliability: 83 },
  politico: { outlet: 'Politico', domain: 'politico.com', biasLean: 'lean-left', reliability: 82 },
  thehill: { outlet: 'The Hill', domain: 'thehill.com', biasLean: 'center', reliability: 78 },
  marketwatch: { outlet: 'MarketWatch', domain: 'marketwatch.com', biasLean: 'center', reliability: 80 },
  verge: { outlet: 'The Verge', domain: 'theverge.com', biasLean: 'lean-left', reliability: 79 },
} as const

type OutletKey = keyof typeof O

function src(key: OutletKey, articleTitle: string, slug: string): Source {
  const base = O[key]
  return {
    outlet: base.outlet,
    domain: base.domain,
    biasLean: base.biasLean,
    reliability: base.reliability,
    articleTitle,
    url: `https://${base.domain}/article/${slug}`,
  }
}

export const STORIES: Story[] = [
  {
    id: 'st_001',
    slug: 'fed-holds-rates-signals-cuts',
    category: 'Finance',
    country: 'United States',
    headline: 'Federal Reserve holds rates steady, signals two cuts later this year',
    aiSummary:
      'The Fed kept its benchmark rate unchanged but penciled in two 2026 cuts, citing cooling inflation and a softening labor market.',
    synthesis:
      'The Federal Reserve left its benchmark interest rate unchanged in the 4.25%-4.50% range, a decision every covering outlet reported identically from the official statement. Policymakers signaled two quarter-point cuts before year-end, conditioned on continued progress toward the 2% inflation target. Reporting converges on the facts of the decision and Chair Powell\u2019s emphasis on "data dependence." Outlets diverge mainly in framing: business desks foreground the dovish projection and the equity rally, while others stress that Powell declined to commit to a timeline and flagged tariff-driven price risks.',
    validityScore: 92,
    validityRationale: 'Corroborated by 7 independent outlets including three wire services; all cite the same FOMC statement.',
    agreements: [
      'The benchmark rate was held in the 4.25%-4.50% range.',
      'The median projection points to two cuts in 2026.',
      'Powell stressed decisions remain "data dependent."',
    ],
    divergences: [
      'Whether the statement should be read as decisively dovish or deliberately noncommittal.',
      'How much weight to give tariff-driven inflation risk in the outlook.',
      'The significance of the same-day equity market rally.',
    ],
    sources: [
      src('reuters', 'Fed holds rates, projects two cuts in 2026', 'fed-holds-rates-signals-cuts'),
      src('ap', 'Federal Reserve keeps rates steady as inflation cools', 'fed-holds-rates-signals-cuts'),
      src('ft', 'Powell signals patience as Fed pencils in two cuts', 'fed-holds-rates-signals-cuts'),
      src('wsj', 'Fed stands pat, eyes later-year easing', 'fed-holds-rates-signals-cuts'),
      src('bloomberg', 'Dot plot shows two 2026 cuts after hold', 'fed-holds-rates-signals-cuts'),
      src('cnbc', 'Stocks rally as Fed hints at cuts ahead', 'fed-holds-rates-signals-cuts'),
      src('foxbiz', 'Fed leaves rates alone, markets cheer', 'fed-holds-rates-signals-cuts'),
    ],
    publishedAt: '2026-06-27T14:05:00Z',
  },
  {
    id: 'st_002',
    slug: 'nvidia-earnings-ai-demand',
    category: 'Markets',
    country: 'United States',
    headline: 'Nvidia tops estimates as data-center demand keeps surging',
    aiSummary:
      'Nvidia beat revenue and profit forecasts on record data-center sales, though guidance left analysts split on the pace of AI spending.',
    synthesis:
      'Nvidia reported quarterly revenue and earnings above Wall Street consensus, driven by record data-center sales tied to AI infrastructure buildout. All outlets agree on the headline beat and the year-over-year growth figures drawn from the company release. Divergence centers on interpretation of forward guidance: some reporting frames it as confirmation that AI demand remains durable, while others note that the sequential growth rate is decelerating and that customer concentration is a risk. Commentary on valuation and the stock\u2019s after-hours move varies by desk.',
    validityScore: 84,
    validityRationale: 'Five outlets corroborate the earnings figures from the official release; interpretation of guidance varies.',
    agreements: [
      'Revenue and EPS came in above analyst consensus.',
      'Data-center segment set a new record.',
      'The company raised its dividend.',
    ],
    divergences: [
      'Whether decelerating sequential growth signals a plateau in AI spend.',
      'How concerning customer concentration is for future quarters.',
      'Whether the current valuation is justified by the guidance.',
    ],
    sources: [
      src('bloomberg', 'Nvidia beats again on AI data-center boom', 'nvidia-earnings-ai-demand'),
      src('cnbc', 'Nvidia tops estimates, shares swing after hours', 'nvidia-earnings-ai-demand'),
      src('ft', 'Nvidia results reaffirm AI capex cycle', 'nvidia-earnings-ai-demand'),
      src('reuters', 'Nvidia quarterly revenue beats on chip demand', 'nvidia-earnings-ai-demand'),
      src('marketwatch', 'What Nvidia\u2019s guidance really tells investors', 'nvidia-earnings-ai-demand'),
    ],
    publishedAt: '2026-06-27T11:30:00Z',
  },
  {
    id: 'st_003',
    slug: 'senate-budget-deal-shutdown-averted',
    category: 'Politics',
    country: 'United States',
    headline: 'Senate reaches bipartisan budget deal, averting government shutdown',
    aiSummary:
      'A bipartisan Senate agreement funds the government through the fiscal year, but the two parties describe the compromise very differently.',
    synthesis:
      'Senate negotiators announced a bipartisan agreement to fund the government and avert a shutdown ahead of the deadline. Outlets across the spectrum agree on the core facts: a deal was reached, it extends funding through the fiscal year, and it passed a procedural vote. The most pronounced divergence is partisan framing of who conceded what \u2014 coverage emphasizes either spending restraint or protected domestic programs depending on the outlet\u2019s lean. There is also disagreement over whether the deal represents durable compromise or merely defers contentious fights.',
    validityScore: 79,
    validityRationale: 'Six outlets confirm the agreement; framing of concessions diverges sharply along partisan lines.',
    agreements: [
      'A bipartisan funding agreement was reached before the deadline.',
      'The deal averts an immediate shutdown.',
      'It cleared an initial procedural vote.',
    ],
    divergences: [
      'Which side made the larger concessions.',
      'Whether spending levels rise or fall in real terms.',
      'Whether the deal resolves or merely postpones the next standoff.',
    ],
    missingNote:
      'Right-leaning outlets gave limited coverage to the protected domestic-program provisions emphasized elsewhere.',
    sources: [
      src('ap', 'Senate strikes deal to keep government open', 'senate-budget-deal-shutdown-averted'),
      src('reuters', 'Bipartisan budget agreement averts US shutdown', 'senate-budget-deal-shutdown-averted'),
      src('politico', 'Inside the late-night budget compromise', 'senate-budget-deal-shutdown-averted'),
      src('nyt', 'Deal protects key programs, Democrats say', 'senate-budget-deal-shutdown-averted'),
      src('wsj', 'Budget pact holds the line on spending', 'senate-budget-deal-shutdown-averted'),
      src('fox', 'Shutdown averted as Senate cuts a deal', 'senate-budget-deal-shutdown-averted'),
    ],
    publishedAt: '2026-06-27T02:15:00Z',
  },
  {
    id: 'st_004',
    slug: 'ecb-rate-decision-eurozone',
    category: 'Finance',
    country: 'Eurozone',
    headline: 'ECB cuts rates a quarter point as eurozone inflation nears target',
    aiSummary:
      'The European Central Bank lowered its key rate by 25 basis points, with Lagarde keeping future moves open as growth stays fragile.',
    synthesis:
      'The European Central Bank reduced its key deposit rate by 25 basis points, a move uniformly reported from the official decision. President Lagarde declined to pre-commit to a path, citing fragile growth and sticky services inflation. Coverage agrees on the cut and on Lagarde\u2019s noncommittal tone. Divergence appears in emphasis: some outlets frame the move as the start of a clear easing cycle, while others highlight internal disagreement on the Governing Council and the risk of cutting too quickly.',
    validityScore: 88,
    validityRationale: 'Confirmed by four high-reliability outlets directly from the ECB statement and press conference.',
    agreements: [
      'The deposit rate was cut by 25 basis points.',
      'Lagarde avoided committing to a future path.',
      'Headline inflation is approaching the 2% target.',
    ],
    divergences: [
      'Whether this marks the start of a sustained easing cycle.',
      'How divided the Governing Council is on the pace of cuts.',
    ],
    sources: [
      src('ft', 'ECB cuts rates, Lagarde keeps options open', 'ecb-rate-decision-eurozone'),
      src('reuters', 'ECB lowers rates as inflation eases', 'ecb-rate-decision-eurozone'),
      src('bloomberg', 'Lagarde signals data-driven path after cut', 'ecb-rate-decision-eurozone'),
      src('economist', 'The ECB\u2019s delicate easing balance', 'ecb-rate-decision-eurozone'),
    ],
    publishedAt: '2026-06-26T13:45:00Z',
  },
  {
    id: 'st_005',
    slug: 'eu-ai-act-enforcement-begins',
    category: 'Tech/AI',
    country: 'Eurozone',
    headline: 'EU begins enforcing landmark AI Act rules for general-purpose models',
    aiSummary:
      'New EU obligations for general-purpose AI take effect, requiring transparency and risk disclosures from major model providers.',
    synthesis:
      'The European Union began enforcing a key phase of its AI Act, imposing transparency, documentation, and systemic-risk obligations on providers of general-purpose models. Outlets agree on what took effect and on the categories of newly regulated obligations. They diverge on impact: technology coverage stresses compliance burden and possible slowed deployment in Europe, while broader outlets frame the rules as a global benchmark for AI governance. There is disagreement over how aggressively regulators will enforce penalties in the near term.',
    validityScore: 81,
    validityRationale: 'Five outlets corroborate the enforcement milestone; projected business impact is interpretive.',
    agreements: [
      'A new enforcement phase of the AI Act took effect.',
      'General-purpose model providers face transparency obligations.',
      'Non-compliance can trigger significant fines.',
    ],
    divergences: [
      'How heavy the compliance burden is for smaller developers.',
      'Whether enforcement will be strict or gradual at first.',
      'Whether the rules set a global standard or fragment the market.',
    ],
    sources: [
      src('reuters', 'EU starts enforcing AI Act rules for big models', 'eu-ai-act-enforcement-begins'),
      src('verge', 'What the AI Act now requires from model makers', 'eu-ai-act-enforcement-begins'),
      src('ft', 'Brussels turns AI rulebook into enforcement', 'eu-ai-act-enforcement-begins'),
      src('guardian', 'Europe pushes ahead on AI oversight', 'eu-ai-act-enforcement-begins'),
      src('economist', 'The world watches Europe\u2019s AI experiment', 'eu-ai-act-enforcement-begins'),
    ],
    publishedAt: '2026-06-26T09:20:00Z',
  },
  {
    id: 'st_006',
    slug: 'oil-prices-supply-tensions',
    category: 'Markets',
    country: 'Global',
    headline: 'Oil jumps as supply worries return to global markets',
    aiSummary:
      'Crude prices climbed on renewed supply concerns, though analysts disagree on whether the move is durable or a short-lived spike.',
    synthesis:
      'Crude oil prices rose sharply amid renewed concerns about global supply. Reporting agrees on the magnitude of the daily move and the immediate trigger cited by traders. The principal divergence is on durability: some analysts quoted see a sustained repricing of supply risk, while others characterize the jump as a speculative spike likely to fade as inventories normalize. Coverage also differs on the downstream impact on inflation and consumer fuel costs.',
    validityScore: 68,
    validityRationale: 'Four outlets confirm the price move; forward-looking claims rely on differing analyst views.',
    agreements: [
      'Benchmark crude prices rose materially on the day.',
      'Traders cited supply-side concerns as the trigger.',
    ],
    divergences: [
      'Whether the rally reflects a durable repricing or a transient spike.',
      'The likely pass-through to inflation and pump prices.',
      'How OPEC+ will respond.',
    ],
    sources: [
      src('reuters', 'Oil surges on renewed supply fears', 'oil-prices-supply-tensions'),
      src('bloomberg', 'Crude spikes as traders weigh supply risk', 'oil-prices-supply-tensions'),
      src('cnbc', 'Why oil jumped and what it means for prices', 'oil-prices-supply-tensions'),
      src('marketwatch', 'Is the oil rally built to last?', 'oil-prices-supply-tensions'),
    ],
    publishedAt: '2026-06-25T16:50:00Z',
  },
  {
    id: 'st_007',
    slug: 'uk-inflation-cools-boe-watch',
    category: 'Finance',
    country: 'United Kingdom',
    headline: 'UK inflation cools more than expected, easing pressure on the Bank of England',
    aiSummary:
      'British inflation fell below forecasts, strengthening the case for a Bank of England rate cut, though wage growth remains a concern.',
    synthesis:
      'UK consumer price inflation slowed more than economists had forecast, according to official statistics every outlet reported from the same release. The data strengthens market expectations of a near-term Bank of England rate cut. Outlets agree on the headline figure and the market reaction in gilts and sterling. They diverge on whether persistent services inflation and wage growth will keep the central bank cautious, and on how quickly any easing would reach households.',
    validityScore: 86,
    validityRationale: 'Confirmed by four outlets from the official ONS release; outlook commentary varies modestly.',
    agreements: [
      'Headline inflation came in below consensus forecasts.',
      'Markets raised the odds of a near-term BoE cut.',
      'Sterling and gilt yields moved on the data.',
    ],
    divergences: [
      'Whether sticky services inflation will delay cuts.',
      'How fast relief reaches household budgets.',
    ],
    sources: [
      src('bbc', 'UK inflation falls faster than expected', 'uk-inflation-cools-boe-watch'),
      src('ft', 'Cooler UK prices lift rate-cut bets', 'uk-inflation-cools-boe-watch'),
      src('reuters', 'British inflation slows, pressuring BoE', 'uk-inflation-cools-boe-watch'),
      src('guardian', 'What falling inflation means for households', 'uk-inflation-cools-boe-watch'),
    ],
    publishedAt: '2026-06-25T07:10:00Z',
  },
  {
    id: 'st_008',
    slug: 'global-trade-tariff-talks',
    category: 'World',
    country: 'Global',
    headline: 'Major economies open fresh round of tariff negotiations',
    aiSummary:
      'Leading economies launched new trade talks aimed at de-escalating tariffs, but reports differ on how close any agreement really is.',
    synthesis:
      'Several major economies opened a new round of negotiations aimed at easing recently raised tariffs. Outlets agree that talks have begun and on the list of participating governments. The clearest divergence is on prospects: some reporting cites officials describing meaningful progress, while others quote sources warning that core disputes remain unresolved and that a deal is far off. Coverage also differs on which sectors would be affected first by any rollback.',
    validityScore: 61,
    validityRationale: 'Four outlets confirm talks began; claims about progress rely on competing anonymous sources.',
    agreements: [
      'A new round of tariff negotiations has started.',
      'Multiple major economies are participating.',
    ],
    divergences: [
      'How much genuine progress has been made.',
      'Which sectors a rollback would touch first.',
      'Whether a near-term agreement is realistic.',
    ],
    sources: [
      src('reuters', 'Economies launch new round of tariff talks', 'global-trade-tariff-talks'),
      src('ap', 'Trade negotiators meet to ease tariffs', 'global-trade-tariff-talks'),
      src('bbc', 'Can the new trade talks lower tariffs?', 'global-trade-tariff-talks'),
      src('axios', 'Behind the scenes of the tariff negotiations', 'global-trade-tariff-talks'),
    ],
    publishedAt: '2026-06-24T18:00:00Z',
  },
]

// --- Mock data-access layer (swap for Supabase queries later) ----------------

export function getStories(profile: Profile = DEMO_PROFILE): Story[] {
  return STORIES.filter(
    (s) =>
      profile.categories.includes(s.category) &&
      (profile.countries.includes(s.country) ||
        profile.countries.includes('Global')),
  ).sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )
}

export function getAllStories(): Story[] {
  return [...STORIES].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )
}

export function getStoryBySlug(slug: string): Story | undefined {
  return STORIES.find((s) => s.slug === slug)
}
