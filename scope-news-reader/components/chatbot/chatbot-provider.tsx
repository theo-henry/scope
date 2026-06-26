'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import type { Story } from '@/lib/types'
import { FilterProvider } from '@/components/filter-provider'
import { ChatbotPanel } from './chatbot-panel'

interface ChatbotContextValue {
  open: boolean
  story: Story | null
  openChat: (story?: Story | null) => void
  closeChat: () => void
}

const ChatbotContext = createContext<ChatbotContextValue | null>(null)

export function ChatbotProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [story, setStory] = useState<Story | null>(null)

  const openChat = useCallback((s?: Story | null) => {
    if (s !== undefined) setStory(s)
    setOpen(true)
  }, [])

  const closeChat = useCallback(() => setOpen(false), [])

  return (
    <ChatbotContext.Provider value={{ open, story, openChat, closeChat }}>
      <FilterProvider>{children}</FilterProvider>
      <ChatbotPanel open={open} story={story} onClose={closeChat} />
    </ChatbotContext.Provider>
  )
}

export function useChatbot() {
  const ctx = useContext(ChatbotContext)
  if (!ctx) throw new Error('useChatbot must be used within ChatbotProvider')
  return ctx
}
