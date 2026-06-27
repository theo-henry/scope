// Server-side data-access layer for Scope. Reads the precomputed Tri-Perspective
// cache produced by the GCP pipeline (backend/synthesize.py -> GCS) and exposes
// the same API the UI already used from the mock layer.
//
// Source: a stable public object `synthesized/latest.json`, fetched server-side
// at build time + revalidated (ISR). If the object is missing/unreachable/invalid
// (e.g. not yet made public), we fall back to the committed sample so the app
// always builds and renders.

import type { Category, Country, Profile, Story } from './types'
import { DEMO_PROFILE, STORIES as SAMPLE_STORIES } from './mock-data'

export { DEMO_PROFILE }
export type { Profile }

const STORIES_URL =
  process.env.SCOPE_STORIES_URL ??
  'https://storage.googleapis.com/scope-news-raw-data/synthesized/latest.json'

// Revalidate the cache hourly; synthesis runs at most once/day per the PRD.
const REVALIDATE_SECONDS = 3600

/** Minimal structural guard so a malformed cache (e.g. the old flat schema) is
 *  rejected and we fall back rather than rendering broken stories. */
function isStory(value: unknown): value is Story {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  const lenses = s.lenses as Record<string, unknown> | undefined
  const image = s.image as Record<string, unknown> | undefined
  const hasValidSourceKey =
    s.sourceKey === undefined || typeof s.sourceKey === 'string'
  const hasValidClusterStats =
    s.clusterStats === undefined ||
    (typeof s.clusterStats === 'object' && s.clusterStats !== null)
  const hasValidImage =
    image === undefined ||
    (typeof image === 'object' &&
      image !== null &&
      typeof image.url === 'string' &&
      typeof image.alt === 'string' &&
      typeof image.width === 'number' &&
      typeof image.height === 'number' &&
      typeof image.mimeType === 'string')
  return (
    typeof s.id === 'string' &&
    typeof s.slug === 'string' &&
    hasValidSourceKey &&
    hasValidClusterStats &&
    typeof s.headline === 'string' &&
    typeof s.category === 'string' &&
    typeof s.country === 'string' &&
    Array.isArray(s.sources) &&
    hasValidImage &&
    !!lenses &&
    typeof lenses.institutional === 'object' &&
    typeof lenses.reformist === 'object' &&
    typeof lenses.skeptic === 'object'
  )
}

function byPublishedDesc(a: Story, b: Story): number {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
}

async function loadAllStories(): Promise<Story[]> {
  try {
    const res = await fetch(STORIES_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) throw new Error(`fetch ${res.status} ${res.statusText}`)
    const data: unknown = await res.json()
    const stories = Array.isArray(data) ? data.filter(isStory) : []
    if (stories.length === 0) throw new Error('no valid stories in cache')
    return stories
  } catch (err) {
    console.warn(
      `[stories] using sample data; could not load ${STORIES_URL}: ${
        (err as Error).message
      }`,
    )
    return SAMPLE_STORIES
  }
}

function matchesProfile(story: Story, profile: Profile): boolean {
  return (
    profile.categories.includes(story.category as Category) &&
    (profile.countries.includes(story.country as Country) ||
      profile.countries.includes('Global'))
  )
}

export async function getStories(profile: Profile = DEMO_PROFILE): Promise<Story[]> {
  const stories = await loadAllStories()
  return stories.filter((s) => matchesProfile(s, profile)).sort(byPublishedDesc)
}

export async function getAllStories(): Promise<Story[]> {
  const stories = await loadAllStories()
  return [...stories].sort(byPublishedDesc)
}

export async function getStoryBySlug(slug: string): Promise<Story | undefined> {
  const stories = await loadAllStories()
  return stories.find((s) => s.slug === slug)
}
