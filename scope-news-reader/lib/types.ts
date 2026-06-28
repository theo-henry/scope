// Domain types for Scope. These mirror the shape of the cached synthesized JSON
// produced by the GCP pipeline (Discovery Engine retrieval -> Gemini synthesis,
// see backend/synthesize.py). The mock layer (lib/mock-data.ts) can be swapped
// for that cached data without touching the UI.

export type Category =
  | 'Finance'
  | 'Markets'
  | 'Politics'
  | 'Tech/AI'
  | 'World'
  | 'Business'
  | 'Science'
  | 'Sports'

export const CATEGORIES: Category[] = [
  'Finance',
  'Markets',
  'Politics',
  'Tech/AI',
  'World',
  'Business',
  'Science',
  'Sports',
]

export const COUNTRIES = [
  'United States',
  'United Kingdom',
  'Eurozone',
  'China',
  'Japan',
  'India',
  'Global',
] as const

export type Country = (typeof COUNTRIES)[number]

// Political lean of an outlet (greyscale UI marker, not colored).
export type BiasLean =
  | 'left'
  | 'lean-left'
  | 'center'
  | 'lean-right'
  | 'right'

export interface Source {
  outlet: string
  domain: string
  biasLean: BiasLean
  /** outlet reliability (0-100) */
  reliability: number
  articleTitle: string
  url: string
}

export type ValidityBand = 'High' | 'Medium' | 'Low'

// --- The Tri-Perspective Lens (PRD §2) ---------------------------------------
// Each story is synthesized into three explicitly named analytical lenses.

/** Lens 1 — official statements, government/regulatory action, established consensus. */
export interface InstitutionalLens {
  /** neutral multi-sentence synthesis of the consensus account */
  synthesis: string
}

/** Lens 2 — market disruption, public/labor reaction, alternative interpretations. */
export interface ReformistLens {
  /** how the divergent/reformist reading frames the event */
  summary: string
  /** points all sources agree on */
  agreements: string[]
  /** points sources diverge on */
  divergences: string[]
}

/** Lens 3 — speculative claims, missing data, bias, and corroboration-based validity. */
export interface SkepticLens {
  /** what is unverified, contested, or narratively skewed */
  summary: string
  /** corroboration-based validity score (0-100) */
  validityScore: number
  /** one-line rationale for the score */
  validityRationale: string
  /** optional "what's missing" note when one side isn't covering */
  missingNote?: string
}

export interface TriPerspectiveLens {
  institutional: InstitutionalLens
  reformist: ReformistLens
  skeptic: SkepticLens
}

export interface StoryImage {
  url: string
  gcsUri?: string
  alt: string
  prompt?: string
  width: number
  height: number
  mimeType: string
  generatedAt?: string
}

export interface ClusterStats {
  query: string
  category: string
  country: string
  raw_docs: number
  recent_docs: number
  deduped_docs: number
  domain_count: number
  domains: string[]
  top_domain_share?: number
  tier_sum: number
  latest_ingested_at?: string
}

/** Display metadata for each lens, in render order. */
export const LENS_META = [
  {
    key: 'institutional' as const,
    n: 1,
    title: 'Institutional',
    subtitle: 'Neutral Synthesis',
  },
  {
    key: 'reformist' as const,
    n: 2,
    title: 'Reformist',
    subtitle: 'Divergence',
  },
  {
    key: 'skeptic' as const,
    n: 3,
    title: 'Skeptic',
    subtitle: 'Bias & Validity',
  },
] as const

export interface Story {
  id: string
  slug: string
  /** stable hash of the retrieved source cluster, used by the backend to avoid resynthesis */
  sourceKey?: string
  /** primary (best-fit) category — drives single-value display */
  category: Category
  /** primary (best-fit) country — drives single-value display */
  country: Country
  /** every category the story belongs to (AI-assigned); drives filtering.
   *  Falls back to [category] for caches synthesized before this field existed. */
  categories?: Category[]
  /** every country the story belongs to (AI-assigned); drives filtering.
   *  Falls back to [country] for older caches. */
  countries?: Country[]
  headline: string
  /** one-line AI summary shown on the feed card and coverage dek */
  aiSummary: string
  /** the three-lens synthesis */
  lenses: TriPerspectiveLens
  sources: Source[]
  /** generated editorial image used by feed cards and story headers */
  image?: StoryImage
  /** backend quality metadata used for refresh reports and debugging */
  clusterStats?: ClusterStats
  /** ISO timestamp */
  publishedAt: string
}

export interface Profile {
  categories: Category[]
  countries: Country[]
}

/** All categories a story can be filtered under (AI-assigned list, or the single
 *  primary category for caches predating the `categories` field). */
export function storyCategories(story: Story): Category[] {
  const list = (story.categories ?? []).filter((c): c is Category =>
    CATEGORIES.includes(c),
  )
  return list.length > 0 ? list : [story.category]
}

/** All countries a story can be filtered under (AI-assigned list, or the single
 *  primary country for older caches). */
export function storyCountries(story: Story): Country[] {
  const list = (story.countries ?? []).filter((c): c is Country =>
    (COUNTRIES as readonly string[]).includes(c),
  )
  return list.length > 0 ? list : [story.country]
}

export function validityBand(score: number): ValidityBand {
  if (score >= 75) return 'High'
  if (score >= 50) return 'Medium'
  return 'Low'
}

export function validityVar(score: number): string {
  const band = validityBand(score)
  if (band === 'High') return 'var(--valid-high)'
  if (band === 'Medium') return 'var(--valid-mid)'
  return 'var(--valid-low)'
}

export const LEAN_LABEL: Record<BiasLean, string> = {
  left: 'Left',
  'lean-left': 'Lean Left',
  center: 'Center',
  'lean-right': 'Lean Right',
  right: 'Right',
}

/** 3-segment position for the mono lean indicator: 0 (left) .. 2 (right). */
export const LEAN_INDEX: Record<BiasLean, 0 | 1 | 2> = {
  left: 0,
  'lean-left': 0,
  center: 1,
  'lean-right': 2,
  right: 2,
}
