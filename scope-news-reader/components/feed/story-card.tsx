'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import type { Story } from '@/lib/types'
import { SPRING } from '@/lib/motion'
import { relativeTime } from '@/lib/format'
import { ValidityPill } from '@/components/validity'
import { SourceAvatars } from '@/components/source-avatars'

export function StoryCard({ story }: { story: Story }) {
  return (
    <motion.article
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={SPRING}
      className="group overflow-hidden rounded-md border border-hairline bg-surface transition-colors hover:border-mist"
    >
      <Link
        href={`/story/${story.slug}`}
        className="grid gap-0 md:grid-cols-[minmax(0,1fr)_220px]"
      >
        <div className="p-6">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-mist">
            <span>{story.category}</span>
            <span>·</span>
            <span>{story.country}</span>
            <span className="ml-auto normal-case tracking-normal">
              {relativeTime(story.publishedAt)}
            </span>
          </div>

          <h2 className="mt-3 text-balance text-2xl font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            {story.headline}
          </h2>

          <p className="mt-2 text-pretty leading-relaxed text-slate">
            {story.aiSummary}
          </p>

          <div className="mt-5 flex items-center justify-between gap-4 border-t border-hairline pt-4">
            <SourceAvatars sources={story.sources} />
            <ValidityPill score={story.lenses.skeptic.validityScore} />
          </div>
        </div>

        {story.image ? (
          <div className="order-first aspect-[16/9] overflow-hidden bg-hairline md:order-none md:h-full md:aspect-auto">
            <img
              src={story.image.url}
              alt={story.image.alt}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
        ) : null}
      </Link>
    </motion.article>
  )
}
