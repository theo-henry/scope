import type { Metadata } from 'next'
import { DEMO_PROFILE } from '@/lib/mock-data'
import { SettingsView } from '@/components/settings/settings-view'

export const metadata: Metadata = {
  title: 'Settings — Scope',
}

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-[1080px] px-5 py-10 md:px-8 md:py-16">
      <SettingsView profile={DEMO_PROFILE} />
    </main>
  )
}
