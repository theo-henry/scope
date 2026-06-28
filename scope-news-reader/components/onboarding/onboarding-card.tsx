'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, Search, Check } from 'lucide-react'
import {
  CATEGORIES,
  COUNTRIES,
  type Category,
  type Country,
  type Profile,
} from '@/lib/types'
import { saveProfile } from '@/app/actions'
import { SPRING, revealUp, stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function OnboardingCard({ initialProfile }: { initialProfile: Profile }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [categories, setCategories] = useState<Category[]>(
    initialProfile.categories,
  )
  const [countries, setCountries] = useState<Country[]>(
    initialProfile.countries,
  )
  const [query, setQuery] = useState('')

  const filteredCountries = useMemo(
    () =>
      COUNTRIES.filter((c) =>
        c.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  )

  function toggle<T>(list: T[], value: T, set: (v: T[]) => void) {
    set(
      list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value],
    )
  }

  const canContinue =
    categories.length > 0 && countries.length > 0 && !isPending

  function handleContinue() {
    startTransition(async () => {
      await saveProfile({ categories, countries })
      router.push('/')
      router.refresh()
    })
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="w-full max-w-[560px] rounded-2xl border border-hairline bg-surface p-8 shadow-[var(--shadow-md)] md:p-10"
    >
      <motion.div variants={revealUp}>
        <span className="text-xl font-semibold tracking-[-0.04em] text-ink">
          Scope<span className="text-mist">.</span>
        </span>
        <h1 className="mt-6 text-balance text-3xl font-semibold leading-[1.1] tracking-[-0.03em] text-ink md:text-4xl">
          Build your morning read
        </h1>
        <p className="mt-3 text-pretty leading-relaxed text-slate">
          Pick the topics and regions you follow. Scope returns the most recent
          matching stories — synthesized, sourced, and scored for trust.
        </p>
      </motion.div>

      <motion.div variants={revealUp} className="mt-8">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-mist">
          Categories
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const selected = categories.includes(cat)
            return (
              <Chip
                key={cat}
                selected={selected}
                onClick={() => toggle(categories, cat, setCategories)}
              >
                {cat}
              </Chip>
            )
          })}
        </div>
      </motion.div>

      <motion.div variants={revealUp} className="mt-7">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-mist">
          Countries
        </p>
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist"
            strokeWidth={1.5}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search regions"
            className="w-full rounded-sm border border-hairline bg-surface py-2.5 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-mist focus:border-ink"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {filteredCountries.map((country) => {
            const selected = countries.includes(country)
            return (
              <Chip
                key={country}
                selected={selected}
                onClick={() => toggle(countries, country, setCountries)}
              >
                {country}
              </Chip>
            )
          })}
          {filteredCountries.length === 0 && (
            <p className="py-2 text-sm text-mist">No regions match.</p>
          )}
        </div>
      </motion.div>

      <motion.div
        variants={revealUp}
        className="mt-9 flex items-center justify-between gap-4"
      >
        <p className="text-xs text-mist">
          {categories.length} topics · {countries.length} regions
        </p>
        <motion.button
          whileHover={{ scale: canContinue ? 1.02 : 1 }}
          whileTap={{ scale: canContinue ? 0.98 : 1 }}
          transition={SPRING}
          disabled={!canContinue}
          onClick={handleContinue}
          className="flex items-center gap-2 rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-opacity disabled:opacity-40"
        >
          {isPending ? 'Saving' : 'Show my feed'}
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

function Chip({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors',
        selected
          ? 'border-ink bg-ink text-paper'
          : 'border-hairline text-slate hover:bg-hairline-2',
      )}
    >
      {selected && <Check className="h-3.5 w-3.5" strokeWidth={2} />}
      {children}
    </button>
  )
}
