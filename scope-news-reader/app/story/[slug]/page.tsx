import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStoryBySlug, STORIES } from '@/lib/mock-data'
import { CoverageHeader } from '@/components/coverage/coverage-header'
import { ValidityMeter } from '@/components/validity'
import { AgreementDivergence } from '@/components/coverage/agreement-divergence'
import { SourceList } from '@/components/coverage/source-list'
import { BiasSpectrum } from '@/components/coverage/bias-spectrum'
import { Reveal } from '@/components/reveal'

export function generateStaticParams() {
  return STORIES.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const story = getStoryBySlug(slug)
  if (!story) return { title: 'Story not found — Scope' }
  return { title: `${story.headline} — Scope`, description: story.aiSummary }
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const story = getStoryBySlug(slug)
  if (!story) notFound()

  return (
    <main className="mx-auto max-w-[1080px] px-5 py-8 md:px-8 md:py-12">
      <CoverageHeader story={story} />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-8">
          <Reveal>
            <ValidityMeter
              score={story.validityScore}
              rationale={story.validityRationale}
            />
          </Reveal>

          <Reveal>
            <h2 className="mb-4 text-2xl font-semibold tracking-[-0.02em] text-ink">
              Where coverage lines up — and splits
            </h2>
            <AgreementDivergence story={story} />
          </Reveal>

          <Reveal>
            <SourceList sources={story.sources} />
          </Reveal>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Reveal>
            <BiasSpectrum sources={story.sources} />
          </Reveal>
        </div>
      </div>
    </main>
  )
}
