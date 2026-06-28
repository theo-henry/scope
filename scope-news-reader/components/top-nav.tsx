'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { MessageSquareText, Moon, Sun, Settings, User } from 'lucide-react'
import { CATEGORIES } from '@/lib/types'
import { useFilter } from '@/components/filter-provider'
import { useChatbot } from '@/components/chatbot/chatbot-provider'
import { cn } from '@/lib/utils'

const PILLS = ['All', ...CATEGORIES] as const

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { active, setActive } = useFilter()
  const { openChat } = useChatbot()

  // Hide the nav on onboarding (full-screen first-run experience)
  if (pathname === '/onboarding') return null

  function selectPill(pill: (typeof PILLS)[number]) {
    setActive(pill)
    if (pathname !== '/') router.push('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-surface/80 backdrop-blur-[20px]">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5 md:px-8">
        {/* Wordmark */}
        <Link
          href="/"
          className="shrink-0 text-xl font-semibold tracking-[-0.04em] text-ink"
        >
          Scope<span className="text-mist">.</span>
        </Link>

        {/* Category pills */}
        <nav className="hidden flex-1 items-center justify-center lg:flex">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {PILLS.map((pill) => {
              const isActive = active === pill
              return (
                <button
                  key={pill}
                  onClick={() => selectPill(pill)}
                  className={cn(
                    'rounded-pill border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-ink bg-ink text-paper'
                      : 'border-hairline text-slate hover:bg-hairline-2',
                  )}
                >
                  {pill}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          <button
            onClick={() => openChat(null)}
            className="flex items-center gap-2 rounded-sm border border-hairline px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-hairline-2"
          >
            <MessageSquareText className="h-4 w-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">Ask Scope</span>
          </button>
          <AvatarMenu />
        </div>
      </div>
    </header>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      aria-label="Toggle dark mode"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex h-9 w-9 items-center justify-center rounded-sm border border-hairline text-ink transition-colors hover:bg-hairline-2"
    >
      {mounted && isDark ? (
        <Sun className="h-4 w-4" strokeWidth={1.5} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.5} />
      )}
    </button>
  )
}

function AvatarMenu() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-hairline-2 text-ink transition-colors hover:bg-hairline"
      >
        <User className="h-4 w-4" strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-48 overflow-hidden rounded-md border border-hairline bg-surface py-1 shadow-[var(--shadow-md)]">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-ink">Demo Profile</p>
            <p className="text-xs text-mist">Finance · Politics</p>
          </div>
          <div className="my-1 h-px bg-hairline" />
          <Link
            href="/settings"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate transition-colors hover:bg-hairline-2"
          >
            <Settings className="h-4 w-4" strokeWidth={1.5} />
            Settings
          </Link>
          <Link
            href="/onboarding"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate transition-colors hover:bg-hairline-2"
          >
            <User className="h-4 w-4" strokeWidth={1.5} />
            Edit preferences
          </Link>
        </div>
      )}
    </div>
  )
}
