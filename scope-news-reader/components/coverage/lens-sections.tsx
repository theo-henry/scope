import { Info } from 'lucide-react'
import type { Story } from '@/lib/types'
import { LENS_META } from '@/lib/types'
import { ValidityMeter } from '@/components/validity'
import { AgreementDivergence } from '@/components/coverage/agreement-divergence'
import { Reveal } from '@/components/reveal'

/** Numbered eyebrow + title shared by all three lens sections. */
function LensHeading({
  n,
  title,
  subtitle,
}: {
  n: number
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-sm font-medium tabular-nums text-mist">
        {String(n).padStart(2, '0')}
      </span>
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
          {title}
        </h2>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-mist">
          {subtitle}
        </p>
      </div>
    </div>
  )
}

/** Renders the story's three explicit lenses in order (PRD §2). */
export function LensSections({ story }: { story: Story }) {
  const { institutional, reformist, skeptic } = story.lenses
  const [meta1, meta2, meta3] = LENS_META

  return (
    <div className="flex flex-col gap-12">
      {/* Lens 1 — Institutional / Neutral Synthesis */}
      <Reveal>
        <section className="flex flex-col gap-4">
          <LensHeading n={meta1.n} title={meta1.title} subtitle={meta1.subtitle} />
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-slate">
            {institutional.synthesis}
          </p>
        </section>
      </Reveal>

      {/* Lens 2 — Reformist / Divergence */}
      <Reveal>
        <section className="flex flex-col gap-4">
          <LensHeading n={meta2.n} title={meta2.title} subtitle={meta2.subtitle} />
          <p className="max-w-2xl text-pretty leading-relaxed text-slate">
            {reformist.summary}
          </p>
          <AgreementDivergence lens={reformist} />
        </section>
      </Reveal>

      {/* Lens 3 — Skeptic / Bias & Validity */}
      <Reveal>
        <section className="flex flex-col gap-4">
          <LensHeading n={meta3.n} title={meta3.title} subtitle={meta3.subtitle} />
          <p className="max-w-2xl text-pretty leading-relaxed text-slate">
            {skeptic.summary}
          </p>
        </section>
      </Reveal>

      {/* Validity */}
      <Reveal>
        <section>
          <ValidityMeter score={skeptic.validityScore} rationale={skeptic.validityRationale} />
        </section>
      </Reveal>

      {/* What's missing */}
      {skeptic.missingNote && (
        <Reveal>
          <section>
            <div className="flex gap-3 rounded-lg border border-dashed border-hairline bg-hairline-2/50 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-mist" strokeWidth={1.5} />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-mist">
                  What&apos;s missing
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate">
                  {skeptic.missingNote}
                </p>
              </div>
            </div>
          </section>
        </Reveal>
      )}
    </div>
  )
}
