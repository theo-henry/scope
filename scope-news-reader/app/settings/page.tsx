import type { Metadata } from 'next'
import { readProfile } from '@/lib/profile'
import { SettingsView } from '@/components/settings/settings-view'

export const metadata: Metadata = {
  title: 'Settings — Scope',
}

export default async function SettingsPage() {
  const profile = await readProfile()
  return (
    <main className="mx-auto max-w-[1080px] px-5 py-10 md:px-8 md:py-16">
      <SettingsView profile={profile} />
    </main>
  )
}
