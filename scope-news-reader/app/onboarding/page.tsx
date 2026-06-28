import { OnboardingCard } from '@/components/onboarding/onboarding-card'
import { readProfile } from '@/lib/profile'

export default async function OnboardingPage() {
  const profile = await readProfile()
  return (
    <main className="mesh relative flex min-h-screen items-center justify-center px-5 py-16">
      <OnboardingCard initialProfile={profile} />
    </main>
  )
}
