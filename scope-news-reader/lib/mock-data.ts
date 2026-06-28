import { CATEGORIES, COUNTRIES, type Profile, type Source, type Story } from './types'

// Default profile used when the visitor has not saved preferences yet. It opts
// into everything so the unfiltered feed shows all categories/regions; editing
// preferences (persisted to a cookie) then narrows the feed. See lib/profile.ts.
export const DEMO_PROFILE: Profile = {
  categories: [...CATEGORIES],
  countries: [...COUNTRIES],
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
    lenses: {
      institutional: {
        synthesis:
          'The Federal Reserve left its benchmark interest rate unchanged in the 4.25%-4.50% range, a decision every covering outlet reported identically from the official statement. Policymakers signaled two quarter-point cuts before year-end, conditioned on continued progress toward the 2% inflation target. Reporting converges on the facts of the decision and Chair Powell\u2019s emphasis on "data dependence."',
      },
      reformist: {
        summary:
          'Business desks foregrounded the dovish projection and the same-day equity rally, framing the two penciled-in cuts as a green light for risk assets ahead of an official easing cycle.',
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
      },
      skeptic: {
        summary:
          'Powell declined to commit to any timeline and explicitly flagged tariff-driven price risks, so the dot-plot projection is a conditional forecast rather than a promise of cuts.',
        validityScore: 92,
        validityRationale: 'Corroborated by 7 independent outlets including three wire services; all cite the same FOMC statement.',
      },
    },
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
    lenses: {
      institutional: {
        synthesis:
          'Nvidia reported quarterly revenue and earnings above Wall Street consensus, driven by record data-center sales tied to AI infrastructure buildout. All outlets agree on the headline beat and the year-over-year growth figures drawn from the company release, and the company raised its dividend.',
      },
      reformist: {
        summary:
          'Bullish coverage read the results as confirmation that the AI capex cycle remains durable, treating the data-center record as proof that hyperscaler spending has further to run.',
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
      },
      skeptic: {
        summary:
          'Skeptical desks flagged that sequential growth is decelerating and that heavy customer concentration leaves forward guidance exposed, making the after-hours move as much about valuation as fundamentals.',
        validityScore: 84,
        validityRationale: 'Five outlets corroborate the earnings figures from the official release; interpretation of guidance varies.',
      },
    },
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
    lenses: {
      institutional: {
        synthesis:
          'Senate negotiators announced a bipartisan agreement to fund the government and avert a shutdown ahead of the deadline. Outlets across the spectrum agree on the core facts: a deal was reached, it extends funding through the fiscal year, and it passed a procedural vote.',
      },
      reformist: {
        summary:
          'Partisan coverage split sharply on who conceded what \u2014 outlets emphasized either hard-won spending restraint or protected domestic programs depending on their lean, reframing the same vote as a win for their side.',
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
      },
      skeptic: {
        summary:
          'It is unclear whether the pact is durable compromise or merely defers the contentious fights, and partisan framing of the concessions makes the real spending trajectory hard to verify.',
        validityScore: 79,
        validityRationale: 'Six outlets confirm the agreement; framing of concessions diverges sharply along partisan lines.',
        missingNote:
          'Right-leaning outlets gave limited coverage to the protected domestic-program provisions emphasized elsewhere.',
      },
    },
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
    lenses: {
      institutional: {
        synthesis:
          'The European Central Bank reduced its key deposit rate by 25 basis points, a move uniformly reported from the official decision. President Lagarde declined to pre-commit to a path, citing fragile growth and sticky services inflation. Coverage agrees on the cut and on Lagarde\u2019s noncommittal tone.',
      },
      reformist: {
        summary:
          'Some outlets framed the cut as the opening move of a clear easing cycle, reading fragile eurozone growth as pressure that will force the ECB to keep loosening through the year.',
        agreements: [
          'The deposit rate was cut by 25 basis points.',
          'Lagarde avoided committing to a future path.',
          'Headline inflation is approaching the 2% target.',
        ],
        divergences: [
          'Whether this marks the start of a sustained easing cycle.',
          'How divided the Governing Council is on the pace of cuts.',
        ],
      },
      skeptic: {
        summary:
          'Other reporting highlighted internal disagreement on the Governing Council and the risk of cutting too quickly, casting doubt on whether a smooth easing cycle is as assured as the dovish read suggests.',
        validityScore: 88,
        validityRationale: 'Confirmed by four high-reliability outlets directly from the ECB statement and press conference.',
      },
    },
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
    lenses: {
      institutional: {
        synthesis:
          'The European Union began enforcing a key phase of its AI Act, imposing transparency, documentation, and systemic-risk obligations on providers of general-purpose models. Outlets agree on what took effect and on the categories of newly regulated obligations, including that non-compliance can trigger significant fines.',
      },
      reformist: {
        summary:
          'Technology coverage stressed the compliance burden and the risk of slowed model deployment in Europe, framing enforcement as a brake on the smaller developers least able to absorb the documentation overhead.',
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
      },
      skeptic: {
        summary:
          'How aggressively regulators will actually levy penalties in the near term is unverified, and claims that the rules set a global benchmark — rather than fragmenting the market — rest on projection rather than evidence.',
        validityScore: 81,
        validityRationale: 'Five outlets corroborate the enforcement milestone; projected business impact is interpretive.',
      },
    },
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
    lenses: {
      institutional: {
        synthesis:
          'Crude oil prices rose sharply amid renewed concerns about global supply. Reporting agrees on the magnitude of the daily move and the immediate trigger cited by traders.',
      },
      reformist: {
        summary:
          'Some analysts quoted read the move as a durable repricing of supply risk, warning of a pass-through to inflation and pump prices if the elevated levels hold.',
        agreements: [
          'Benchmark crude prices rose materially on the day.',
          'Traders cited supply-side concerns as the trigger.',
        ],
        divergences: [
          'Whether the rally reflects a durable repricing or a transient spike.',
          'The likely pass-through to inflation and pump prices.',
          'How OPEC+ will respond.',
        ],
      },
      skeptic: {
        summary:
          'Others characterized the jump as a speculative spike likely to fade as inventories normalize, and every forward-looking claim about inflation or an OPEC+ response rests on competing analyst views rather than confirmed data.',
        validityScore: 68,
        validityRationale: 'Four outlets confirm the price move; forward-looking claims rely on differing analyst views.',
      },
    },
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
    lenses: {
      institutional: {
        synthesis:
          'UK consumer price inflation slowed more than economists had forecast, according to official statistics every outlet reported from the same ONS release. The data strengthens market expectations of a near-term Bank of England rate cut, and outlets agree on the headline figure and the market reaction in gilts and sterling.',
      },
      reformist: {
        summary:
          'Coverage aimed at households framed the cooler print as imminent relief, emphasizing how a BoE cut would ease mortgage and borrowing costs after a prolonged squeeze.',
        agreements: [
          'Headline inflation came in below consensus forecasts.',
          'Markets raised the odds of a near-term BoE cut.',
          'Sterling and gilt yields moved on the data.',
        ],
        divergences: [
          'Whether sticky services inflation will delay cuts.',
          'How fast relief reaches household budgets.',
        ],
      },
      skeptic: {
        summary:
          'More cautious analysis warned that persistent services inflation and wage growth could keep the Bank cautious, so the market-implied cut may arrive later and reach household budgets more slowly than the headline suggests.',
        validityScore: 86,
        validityRationale: 'Confirmed by four outlets from the official ONS release; outlook commentary varies modestly.',
      },
    },
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
    lenses: {
      institutional: {
        synthesis:
          'Several major economies opened a new round of negotiations aimed at easing recently raised tariffs. Outlets agree that talks have begun and on the list of participating governments.',
      },
      reformist: {
        summary:
          'Some reporting cited officials describing meaningful progress, presenting the round as a genuine de-escalation that could begin rolling back tariffs on the most affected sectors.',
        agreements: [
          'A new round of tariff negotiations has started.',
          'Multiple major economies are participating.',
        ],
        divergences: [
          'How much genuine progress has been made.',
          'Which sectors a rollback would touch first.',
          'Whether a near-term agreement is realistic.',
        ],
      },
      skeptic: {
        summary:
          'Other coverage quoted sources warning that core disputes remain unresolved and a deal is far off; with progress claims resting on competing anonymous sources, the optimistic framing is hard to verify.',
        validityScore: 61,
        validityRationale: 'Four outlets confirm talks began; claims about progress rely on competing anonymous sources.',
      },
    },
    sources: [
      src('reuters', 'Economies launch new round of tariff talks', 'global-trade-tariff-talks'),
      src('ap', 'Trade negotiators meet to ease tariffs', 'global-trade-tariff-talks'),
      src('bbc', 'Can the new trade talks lower tariffs?', 'global-trade-tariff-talks'),
      src('axios', 'Behind the scenes of the tariff negotiations', 'global-trade-tariff-talks'),
    ],
    publishedAt: '2026-06-24T18:00:00Z',
  },
]

// STORIES above is the committed sample used as the fallback in lib/stories.ts
// when the synthesized cache (synthesized/latest.json) is unreachable or invalid.
// The live data-access API (getStories / getAllStories / getStoryBySlug) lives in
// lib/stories.ts and reads the real cache.
