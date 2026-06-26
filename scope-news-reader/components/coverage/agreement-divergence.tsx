import { Check, GitBranch, Info } from 'lucide-react'
import type { Story } from '@/lib/types'

export function AgreementDivergence({ story }: { story: Story }) {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-hairline bg-surface p-6">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-ink" strokeWidth={1.5} />
            <h3 className="text-base font-medium text-ink">All sources agree</h3>
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {story.agreements.map((point) => (
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
            {story.divergences.map((point) => (
              <li key={point} className="flex gap-3 text-sm leading-relaxed text-slate">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-mist" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {story.missingNote && (
        <div className="mt-4 flex gap-3 rounded-lg border border-dashed border-hairline bg-hairline-2/50 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-mist" strokeWidth={1.5} />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-mist">
              What&apos;s missing
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate">
              {story.missingNote}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
