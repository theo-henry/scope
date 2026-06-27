import type { Source } from '@/lib/types'
import { cn } from '@/lib/utils'
import { OutletLogo } from '@/components/outlet-logo'

/** A row of outlet favicons + an "+N outlets" counter. */
export function SourceAvatars({
  sources,
  max = 4,
  className,
}: {
  sources: Source[]
  max?: number
  className?: string
}) {
  const shown = sources.slice(0, max)
  const extra = sources.length - shown.length
  return (
    <div className={cn('flex items-center', className)}>
      <div className="flex -space-x-1.5">
        {shown.map((s, i) => (
          <OutletLogo
            key={`${i}-${s.domain}`}
            domain={s.domain}
            outlet={s.outlet}
            size="sm"
          />
        ))}
      </div>
      <span className="ml-2 text-xs font-medium text-mist">
        {extra > 0 ? `+${extra} outlets` : `${sources.length} outlets`}
      </span>
    </div>
  )
}
