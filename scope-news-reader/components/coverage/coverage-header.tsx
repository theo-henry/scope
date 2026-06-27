'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, MessageSquareText } from 'lucide-react'
import type { Story } from '@/lib/types'
import { relativeTime } from '@/lib/format'
import { revealUp, stagger } from '@/lib/motion'
import { useChatbot } from '@/components/chatbot/chatbot-provider'

export function CoverageHeader({ story }: { story: Story }) {
  const { openChat } = useChatbot()

  return (
    <div className="relative overflow-hidden rounded-2xl bg-graphite grain">
      {story.image ? (
        <img
          src={story.image.url}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="aurora" />
      )}
      {/* Legibility scrim */}
      <div className="absolute inset-0 bg-[#0b0b0c]/35" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0b0c]/25 via-[#0b0b0c]/50 to-[#0b0b0c]/80" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 p-7 md:p-12"
      >
        <motion.div variants={revealUp} className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#c8cad0] transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Feed
          </Link>
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#a5a7ad]">
            <span>{story.category}</span>
            <span>·</span>
            <span>{story.country}</span>
            <span className="normal-case tracking-normal">
              · {relativeTime(story.publishedAt)}
            </span>
          </div>
        </motion.div>

        <motion.h1
          variants={revealUp}
          className="mt-8 max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-[#f4f5f7] md:text-6xl"
        >
          {story.headline}
        </motion.h1>

        <motion.div variants={revealUp} className="mt-7 max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#a5a7ad]">
            Tri-Perspective Lens
          </p>
          <p className="mt-2 text-pretty text-lg leading-relaxed text-[#dfe0e4]">
            {story.aiSummary}
          </p>
        </motion.div>

        <motion.div variants={revealUp} className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={() => openChat(story)}
            className="inline-flex items-center gap-2 rounded-sm bg-[#f4f5f7] px-4 py-2.5 text-sm font-medium text-[#0b0b0c] transition-opacity hover:opacity-90"
          >
            <MessageSquareText className="h-4 w-4" strokeWidth={1.5} />
            Ask about this story
          </button>
          <span className="text-sm text-[#a5a7ad]">
            {story.sources.length} outlets covering
          </span>
        </motion.div>
      </motion.div>
    </div>
  )
}
