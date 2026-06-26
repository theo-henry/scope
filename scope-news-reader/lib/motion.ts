import type { Variants } from 'framer-motion'

// Master easing & timing (DESIGN.md §6)
export const EASE = [0.44, 0, 0.56, 1] as const
export const DUR = { fast: 0.4, base: 0.6, slow: 0.8 } as const
export const SPRING = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  mass: 1,
} as const

// A. Blur-up reveal — the signature entrance
export const revealUp: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(5px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: DUR.base, ease: EASE },
  },
}

// Container staggers children
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

// Page / route cross-fade with slight blur
export const pageFade: Variants = {
  hidden: { opacity: 0, filter: 'blur(4px)' },
  show: {
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: DUR.fast, ease: EASE },
  },
}

// Shared viewport config for whileInView reveals
export const viewportOnce = { once: true, margin: '-10%' } as const
