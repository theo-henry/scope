'use client'

import Link from 'next/link'
import { CircleCheck, Cpu, Database, KeyRound } from 'lucide-react'
import type { Profile } from '@/lib/types'
import { Reveal } from '@/components/reveal'

// Read-only, env-driven view. Real values come from server env at build/runtime;
// no key is ever rendered.
const MODEL_STATUS = [
  { label: 'Synthesis & chat model', value: 'gemini-2.5-flash', source: 'SCOPE_GEMINI_MODEL' },
  { label: 'Story image model', value: 'gemini-3.1-flash-image', source: 'SCOPE_GEMINI_IMAGE_MODEL' },
  { label: 'Provider', value: 'Google · Gemini', source: 'server env' },
  { label: 'Retrieval', value: 'Discovery Engine', source: 'SCOPE_SEARCH_ENGINE_ID' },
  { label: 'Story data', value: 'GCS · latest.json', source: 'SCOPE_STORIES_URL' },
]

export function SettingsView({ profile }: { profile: Profile }) {
  return (
    <Reveal>
      <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">
        Settings
      </h1>
      <p className="mt-1 text-sm text-slate">
        Preferences and the active model configuration.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Preferences */}
        <section className="rounded-lg border border-hairline bg-surface p-6">
          <h2 className="text-base font-medium text-ink">Preferences</h2>
          <p className="mt-1 text-sm text-slate">
            Saved preferences filter every page. Edit them to change your feed.
          </p>

          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-mist">
              Categories
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.categories.map((c) => (
                <span
                  key={c}
                  className="rounded-pill border border-hairline px-3 py-1 text-xs font-medium text-slate"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-mist">
              Countries
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.countries.map((c) => (
                <span
                  key={c}
                  className="rounded-pill border border-hairline px-3 py-1 text-xs font-medium text-slate"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <Link
            href="/onboarding"
            className="mt-6 inline-flex rounded-sm border border-hairline px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-hairline-2"
          >
            Edit preferences
          </Link>
        </section>

        {/* Model / provider status */}
        <section className="rounded-lg border border-hairline bg-surface p-6">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-ink" strokeWidth={1.5} />
            <h2 className="text-base font-medium text-ink">Model & provider</h2>
          </div>
          <p className="mt-1 text-sm text-slate">
            Read from server environment variables. Keys are never displayed.
          </p>

          <ul className="mt-5 flex flex-col divide-y divide-hairline">
            {MODEL_STATUS.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate">{row.label}</p>
                  <p className="truncate font-mono text-xs text-mist">
                    {row.source}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-ink">
                  {row.value}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center gap-2 rounded-md border border-hairline bg-hairline-2/50 p-3">
            <KeyRound className="h-4 w-4 shrink-0 text-mist" strokeWidth={1.5} />
            <p className="text-xs leading-relaxed text-slate">
              <span className="inline-flex items-center gap-1 font-medium text-ink">
                <CircleCheck className="h-3.5 w-3.5 text-[color:var(--valid-high)]" strokeWidth={1.5} />
                Server-side only
              </span>{' '}
              — GEMINI_API_KEY runs in the /api/chat route handler and never
              reaches the client.
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-mist">
            <Database className="h-3.5 w-3.5" strokeWidth={1.5} />
            Feed reads persisted data; live fetching runs in the refresh pipeline.
          </div>
        </section>
      </div>
    </Reveal>
  )
}
