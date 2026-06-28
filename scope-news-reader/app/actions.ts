'use server'

import { cookies } from 'next/headers'
import { PROFILE_COOKIE, sanitizeProfile } from '@/lib/profile'
import type { Profile } from '@/lib/types'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// Persist the visitor's preferences to a cookie. Called from the onboarding
// client component; server pages read it back via readProfile().
export async function saveProfile(profile: Profile) {
  const clean = sanitizeProfile(profile)
  const store = await cookies()
  store.set(PROFILE_COOKIE, JSON.stringify(clean), {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
  })
  return clean
}
