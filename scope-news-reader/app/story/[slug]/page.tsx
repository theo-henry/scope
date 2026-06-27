import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStoryBySlug, getAllStories } from '@/lib/stories'
import { CoverageHeader } from '@/components/coverage/coverage-header'
import { LensSections } from '@/components/coverage/lens-sections'
import { SourceList } from '@/components/coverage/source-list'
import { BiasSpectrum } from '@/components/coverage/bias-spectrum'
import { Reveal } from '@/components/reveal'

export const revalidate = 3600
// Allow stories that appear in the cache after build to render on demand.
export const dynamicParams = true

export async function generateStaticParams() {
  const stories = await getAllStories()
  return stories.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const story = await getStoryBySlug(slug)
  if (!story) return { title: 'Story not found — Scope' }
  return {
    title: `${story.headline} — Scope`,
    description: story.aiSummary,
    openGraph: story.image
      ? {
          title: `${story.headline} — Scope`,
          description: story.aiSummary,
          images: [
            {
              url: story.image.url,
              width: story.image.width,
              height: story.image.height,
              alt: story.image.alt,
            },
          ],
        }
      : undefined,
  }
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const story = await getStoryBySlug(slug)
  if (!story) notFound()

  return (
    <main className="mx-auto max-w-[1080px] px-5 py-8 md:px-8 md:py-12">
      <CoverageHeader story={story} />

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-12">
          <LensSections story={story} />

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
