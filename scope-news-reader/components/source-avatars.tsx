import type { Source } from '@/lib/types'
import { cn } from '@/lib/utils'

/** A row of small greyscale outlet initials + an "+N outlets" counter. */
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
        {shown.map((s) => (
          <span
            key={s.domain}
            title={s.outlet}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-hairline bg-hairline-2 text-[10px] font-semibold text-slate logo-grey"
          >
            {s.outlet.charAt(0)}
          </span>
        ))}
      </div>
      <span className="ml-2 text-xs font-medium text-mist">
        {extra > 0 ? `+${extra} outlets` : `${sources.length} outlets`}
      </span>
    </div>
  )
}
