'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { validityBand, validityVar } from '@/lib/types'
import { EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

function bandIcon(band: string, className: string) {
  if (band === 'High') return <ShieldCheck className={className} strokeWidth={1.5} />
  if (band === 'Medium') return <ShieldAlert className={className} strokeWidth={1.5} />
  return <ShieldX className={className} strokeWidth={1.5} />
}

/** Small color-coded pill for feed cards. Color is always paired with a label. */
export function ValidityPill({
  score,
  className,
}: {
  score: number
  className?: string
}) {
  const band = validityBand(score)
  const color = validityVar(score)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-medium',
        className,
      )}
      style={{ color, borderColor: color }}
    >
      {bandIcon(band, 'h-3.5 w-3.5')}
      {band}
      <span className="text-mist">·</span>
      <span className="tabular-nums">{score}</span>
    </span>
  )
}

/** The validity meter on the coverage view — the most colorful element on screen. */
export function ValidityMeter({
  score,
  rationale,
}: {
  score: number
  rationale: string
}) {
  const band = validityBand(score)
  const color = validityVar(score)
  return (
    <div className="rounded-lg border border-hairline bg-surface p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{bandIcon(band, 'h-5 w-5')}</span>
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-mist">
            Validity
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="text-3xl font-semibold tabular-nums tracking-[-0.03em]"
            style={{ color }}
          >
            {score}
          </span>
          <span className="text-sm text-mist">/ 100</span>
          <span className="text-sm font-medium" style={{ color }}>
            {band}
          </span>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-pill bg-hairline">
        <motion.div
          className="h-full rounded-pill"
          style={{ background: color }}
          initial={{ width: 0 }}
          whileInView={{ width: `${score}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate">{rationale}</p>
    </div>
  )
}
