import { Check, GitBranch } from 'lucide-react'
import type { ReformistLens } from '@/lib/types'

export function AgreementDivergence({ lens }: { lens: ReformistLens }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-hairline bg-surface p-6">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-ink" strokeWidth={1.5} />
          <h3 className="text-base font-medium text-ink">All sources agree</h3>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {lens.agreements.map((point) => (
            <li key={point} className="flex gap-3 text-sm leading-relaxed text-slate">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-mist" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-hairline bg-surface p-6">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-ink" strokeWidth={1.5} />
          <h3 className="text-base font-medium text-ink">Sources differ on</h3>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {lens.divergences.map((point) => (
            <li key={point} className="flex gap-3 text-sm leading-relaxed text-slate">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-mist" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
