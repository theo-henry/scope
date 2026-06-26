'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { revealUp, stagger, viewportOnce } from '@/lib/motion'

/** A single blur-up reveal element. */
export function Reveal({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'li' | 'article' | 'header'
}) {
  const Comp = motion[as]
  return (
    <Comp
      variants={revealUp}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      className={className}
    >
      {children}
    </Comp>
  )
}

/** A staggered container whose direct <RevealItem> children animate in sequence. */
export function RevealGroup({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'ul' | 'ol'
}) {
  const Comp = motion[as]
  return (
    <Comp
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      className={className}
    >
      {children}
    </Comp>
  )
}

export function RevealItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'li' | 'article'
}) {
  const Comp = motion[as]
  return (
    <Comp variants={revealUp} className={className}>
      {children}
    </Comp>
  )
}
