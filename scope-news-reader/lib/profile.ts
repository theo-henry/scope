// Server-side reader for the visitor's saved preferences. The profile is stored
// in a cookie (written by the `saveProfile` server action in app/actions.ts) so
// that every server-rendered page (feed, settings, onboarding) filters from one
// source of truth. No auth in v1 — the cookie is the whole "account".

import { cookies } from 'next/headers'
import {
  CATEGORIES,
  COUNTRIES,
  type Category,
  type Country,
  type Profile,
} from './types'
import { DEMO_PROFILE } from './mock-data'

export const PROFILE_COOKIE = 'scope_profile'

/** Validate untrusted input (cookie / action payload) down to a real Profile,
 *  dropping unknown values and falling back to DEMO_PROFILE if either axis ends
 *  up empty (an empty filter would render an empty site). */
export function sanitizeProfile(raw: unknown): Profile {
  if (typeof raw !== 'object' || raw === null) return DEMO_PROFILE
  const r = raw as Record<string, unknown>
  const categories = Array.isArray(r.categories)
    ? r.categories.filter((c): c is Category =>
        CATEGORIES.includes(c as Category),
      )
    : []
  const countries = Array.isArray(r.countries)
    ? r.countries.filter((c): c is Country =>
        (COUNTRIES as readonly string[]).includes(c as string),
      )
    : []
  if (categories.length === 0 || countries.length === 0) return DEMO_PROFILE
  return { categories, countries }
}

export async function readProfile(): Promise<Profile> {
  const store = await cookies()
  const raw = store.get(PROFILE_COOKIE)?.value
  if (!raw) return DEMO_PROFILE
  try {
    return sanitizeProfile(JSON.parse(raw))
  } catch {
    return DEMO_PROFILE
  }
}
