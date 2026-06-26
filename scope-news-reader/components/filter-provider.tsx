'use client'

import { createContext, useContext, useState } from 'react'
import type { Category } from '@/lib/types'

type Filter = Category | 'All'

interface FilterContextValue {
  active: Filter
  setActive: (f: Filter) => void
}

const FilterContext = createContext<FilterContextValue | null>(null)

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Filter>('All')
  return (
    <FilterContext.Provider value={{ active, setActive }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilter() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilter must be used within FilterProvider')
  return ctx
}
