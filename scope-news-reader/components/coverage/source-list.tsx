import { ExternalLink } from 'lucide-react'
import type { Source } from '@/lib/types'
import { BiasBadge } from '@/components/bias-badge'
import { OutletLogo } from '@/components/outlet-logo'

export function SourceList({ sources }: { sources: Source[] }) {
  return (
    <div>
      <h3 className="text-base font-medium text-ink">
        Sources <span className="text-mist">({sources.length})</span>
      </h3>
      <ul className="mt-4 overflow-hidden rounded-lg border border-hairline bg-surface">
        {sources.map((s, i) => (
          <li
            key={`${i}-${s.url || s.domain}`}
            className="flex flex-col gap-3 p-5 transition-colors hover:bg-hairline-2/60 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderTop: i === 0 ? 'none' : '1px solid var(--hairline)' }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <OutletLogo domain={s.domain} outlet={s.outlet} size="md" />
                <span className="text-sm font-medium text-ink">{s.outlet}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                {s.articleTitle}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
              <BiasBadge lean={s.biasLean} reliability={s.reliability} />
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate transition-colors hover:text-ink"
              >
                Read
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
