import { DEMO_PROFILE, getStories } from '@/lib/stories'
import { FeedList } from '@/components/feed/feed-list'

export const revalidate = 3600

export default async function HomePage() {
  const stories = await getStories(DEMO_PROFILE)

  return (
    <main className="mx-auto max-w-[720px] px-5 py-10 md:px-8 md:py-16">
      <FeedList stories={stories} />
    </main>
  )
}
