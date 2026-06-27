'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ArrowUp, MessageSquareText } from 'lucide-react'
import type { Story } from '@/lib/types'
import { SPRING } from '@/lib/motion'
import { SUGGESTED_QUESTIONS, type Citation } from '@/lib/mock-chat'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  citations?: Citation[]
}

export function ChatbotPanel({
  open,
  story,
  onClose,
}: {
  open: boolean
  story: Story | null
  onClose: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  // Reset thread when the seeded story changes.
  useEffect(() => {
    setMessages([])
  }, [story?.id])

  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = original
      }
    }
  }, [open])

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, streaming])

  function send(text: string) {
    const q = text.trim()
    if (!q || streaming) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: q }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setStreaming(true)

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, story }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json() as Promise<{ text: string; citations: Citation[] }>
      })
      .then((ans) => {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: ans.text,
            citations: ans.citations ?? [],
          },
        ])
      })
      .catch(() => {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: "Couldn't reach the answer service — please try again.",
            citations: [],
          },
        ])
      })
      .finally(() => setStreaming(false))
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-ink/20 backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={SPRING}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[380px] flex-col border-l border-hairline bg-surface shadow-[var(--shadow-lg)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-hairline p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-ink" strokeWidth={1.5} />
                  <span className="text-sm font-semibold text-ink">Ask Scope</span>
                </div>
                <p className="mt-1 truncate text-xs text-mist">
                  {story
                    ? `Grounded in ${story.sources.length} sources · ${story.headline}`
                    : 'Open a story to ground the assistant'}
                </p>
              </div>
              <button
                aria-label="Close chat"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-slate transition-colors hover:bg-hairline-2"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Thread */}
            <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-slate">
                    I answer only from the articles loaded for this story, and
                    cite each outlet. If something isn&apos;t in the sources, I&apos;ll
                    say so.
                  </p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="rounded-md border border-hairline px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-hairline-2"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-md rounded-br-sm bg-hairline-2 px-3.5 py-2.5 text-sm leading-relaxed text-ink">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-start">
                    <div className="max-w-[90%] rounded-md rounded-bl-sm border border-hairline bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-slate">
                      {m.text}
                      {m.citations && m.citations.length > 0 && (
                        <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                          {m.citations.map((c) => (
                            <a
                              key={`${m.id}-${c.n}`}
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={c.outlet}
                              className="inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] border border-hairline bg-hairline-2 px-1 text-[10px] font-semibold text-slate transition-colors hover:border-ink hover:text-ink"
                            >
                              {c.n}
                            </a>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )}

              {streaming && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-md border border-hairline bg-surface px-3.5 py-3">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-mist"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
              className="border-t border-hairline p-4"
            >
              <div className="flex items-end gap-2 rounded-md border border-hairline bg-surface p-2 focus-within:border-ink">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send(input)
                    }
                  }}
                  rows={1}
                  placeholder="Ask about this story…"
                  className="max-h-28 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm text-ink outline-none placeholder:text-mist"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || streaming}
                  aria-label="Send"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-ink text-paper transition-opacity disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
