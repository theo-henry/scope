import { LEAN_INDEX, LEAN_LABEL, type BiasLean } from '@/lib/types'
import { cn } from '@/lib/utils'

/** A 3-segment monochrome indicator of political lean (left / center / right). */
export function LeanIndicator({ lean }: { lean: BiasLean }) {
  const idx = LEAN_INDEX[lean]
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i === idx ? 'bg-ink' : 'bg-hairline',
          )}
        />
      ))}
    </span>
  )
}

/** Reliability dot. Greyscale by default; high reliability may borrow a validity hue. */
export function ReliabilityDot({ score }: { score: number }) {
  const color =
    score >= 88 ? 'var(--valid-high)' : score >= 78 ? 'var(--mist)' : 'var(--slate)'
  return (
    <span
      className="h-1.5 w-1.5 rounded-full"
      style={{ background: color }}
      aria-hidden
    />
  )
}

/** Tiny pill: lean marker + label + reliability. Monochrome by default. */
export function BiasBadge({
  lean,
  reliability,
  className,
}: {
  lean: BiasLean
  reliability: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface px-2 py-1 text-[11px] font-medium text-slate',
        className,
      )}
    >
      <LeanIndicator lean={lean} />
      <span>{LEAN_LABEL[lean]}</span>
      <span className="text-mist">·</span>
      <span className="flex items-center gap-1 text-mist">
        <ReliabilityDot score={reliability} />
        {reliability}
      </span>
    </span>
  )
}
