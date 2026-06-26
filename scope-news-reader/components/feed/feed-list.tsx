'use client'

import { useMemo, useState } from 'react'
import { RotateCw } from 'lucide-react'
import type { Story } from '@/lib/types'
import { useFilter } from '@/components/filter-provider'
import { RevealGroup, RevealItem } from '@/components/reveal'
import { StoryCard } from './story-card'

export function FeedList({ stories }: { stories: Story[] }) {
  const { active } = useFilter()
  const [refreshing, setRefreshing] = useState(false)

  const filtered = useMemo(
    () =>
      active === 'All'
        ? stories
        : stories.filter((s) => s.category === active),
    [stories, active],
  )

  // Placeholder for the future api/refresh pipeline trigger.
  function refresh() {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1100)
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">
            Your feed
          </h1>
          <p className="mt-1 text-sm text-slate">
            {filtered.length} {active === 'All' ? '' : `${active.toLowerCase()} `}stories · newest first
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-sm border border-hairline px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-hairline-2 disabled:opacity-60"
        >
          <RotateCw
            className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            strokeWidth={1.5}
          />
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-slate">
          No stories in this category yet.
        </p>
      ) : (
        <RevealGroup as="ul" className="flex flex-col gap-4">
          {filtered.map((story) => (
            <RevealItem as="li" key={story.id}>
              <StoryCard story={story} />
            </RevealItem>
          ))}
        </RevealGroup>
      )}
    </div>
  )
}
