import { getStories } from '@/lib/stories'
import { readProfile } from '@/lib/profile'
import { FeedList } from '@/components/feed/feed-list'

// Reads the per-visitor profile cookie, so the page renders dynamically. The
// underlying story cache is still revalidated hourly inside loadAllStories().
export default async function HomePage() {
  const profile = await readProfile()
  const stories = await getStories(profile)

  return (
    <main className="mx-auto max-w-[720px] px-5 py-10 md:px-8 md:py-16">
      <FeedList stories={stories} />
    </main>
  )
}
