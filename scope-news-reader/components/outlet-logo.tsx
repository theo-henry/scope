'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

const FAVICON_URL = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

/** Outlet favicon inside a circular frame, falls back to first-letter avatar on error. */
export function OutletLogo({
  domain,
  outlet,
  size = 'sm',
  className,
}: {
  domain: string
  outlet: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  const frame = cn(
    'flex shrink-0 items-center justify-center rounded-full border border-hairline overflow-hidden',
    size === 'sm' ? 'h-6 w-6' : 'h-7 w-7',
    className,
  )

  if (failed) {
    return (
      <span
        className={cn(
          frame,
          'bg-hairline-2 font-semibold text-slate logo-grey',
          size === 'sm' ? 'text-[10px]' : 'text-xs',
        )}
      >
        {outlet.charAt(0)}
      </span>
    )
  }

  return (
    <span className={cn(frame, 'bg-surface')}>
      <img
        src={FAVICON_URL(domain)}
        alt={outlet}
        width={size === 'sm' ? 24 : 28}
        height={size === 'sm' ? 24 : 28}
        onError={() => setFailed(true)}
        className="h-full w-full object-contain p-[3px]"
      />
    </span>
  )
}
