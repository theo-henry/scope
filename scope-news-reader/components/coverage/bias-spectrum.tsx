import type { Source } from '@/lib/types'
import { LEAN_INDEX } from '@/lib/types'

const BUCKETS = [
  { key: 0, label: 'Left' },
  { key: 1, label: 'Center' },
  { key: 2, label: 'Right' },
] as const

export function BiasSpectrum({ sources }: { sources: Source[] }) {
  const counts = [0, 0, 0]
  for (const s of sources) counts[LEAN_INDEX[s.biasLean]]++
  const max = Math.max(1, ...counts)
  const total = sources.length
  const avgReliability = Math.round(
    sources.reduce((sum, s) => sum + s.reliability, 0) / total,
  )

  return (
    <aside className="rounded-lg border border-hairline bg-surface p-6">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-mist">
        Coverage spectrum
      </p>

      <div className="mt-5 flex items-end justify-between gap-3">
        {BUCKETS.map((b) => (
          <div key={b.key} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-sm font-semibold tabular-nums text-ink">
              {counts[b.key]}
            </span>
            <div className="flex h-24 w-full items-end">
              <div
                className="w-full rounded-sm bg-ink/85"
                style={{ height: `${(counts[b.key] / max) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-mist">{b.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-hairline pt-5">
        <Stat label="Outlets" value={String(total)} />
        <Stat label="Avg. reliability" value={`${avgReliability}/100`} />
        <Stat
          label="Balance"
          value={counts[0] > 0 && counts[2] > 0 ? 'Both sides' : 'One-sided'}
        />
      </div>
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  )
}
