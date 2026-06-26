// Domain types for Scope. These mirror the future Supabase row shapes so the
// mock layer (lib/mock-data.ts) can be swapped for real route handlers
// (api/refresh, api/chat) + Supabase without touching the UI.

export type Category =
  | 'Finance'
  | 'Markets'
  | 'Politics'
  | 'Tech/AI'
  | 'World'
  | 'Business'
  | 'Science'

export const CATEGORIES: Category[] = [
  'Finance',
  'Markets',
  'Politics',
  'Tech/AI',
  'World',
  'Business',
  'Science',
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
  /** maps to articles.source_name */
  outlet: string
  /** maps to articles.source_domain */
  domain: string
  /** maps to outlet_bias.bias_lean */
  biasLean: BiasLean
  /** maps to outlet_bias.reliability_score (0-100) */
  reliability: number
  /** maps to articles.title */
  articleTitle: string
  /** maps to articles.url */
  url: string
}

export type ValidityBand = 'High' | 'Medium' | 'Low'

export interface Story {
  id: string
  slug: string
  category: Category
  country: Country
  headline: string
  /** one-line AI summary shown on the feed card */
  aiSummary: string
  /** neutral multi-sentence synthesis shown on the coverage view */
  synthesis: string
  /** maps to stories.validity_score */
  validityScore: number
  /** one-line rationale for the score */
  validityRationale: string
  /** points all sources agree on */
  agreements: string[]
  /** points sources diverge on (stories.divergence jsonb) */
  divergences: string[]
  /** optional "what's missing" note when one side isn't covering */
  missingNote?: string
  sources: Source[]
  /** ISO timestamp, maps to articles.published_at */
  publishedAt: string
}

export interface Profile {
  categories: Category[]
  countries: Country[]
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
