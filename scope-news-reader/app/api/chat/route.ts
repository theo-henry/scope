import type { NextRequest } from 'next/server'
import type { Story } from '@/lib/types'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? ''
const MODEL = process.env.SCOPE_GEMINI_MODEL ?? 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const SYSTEM_PROMPT =
  'You are Scope\'s grounded chat assistant. You answer questions ONLY from the ' +
  'story context provided. Rules: (1) Use ONLY facts present in the context — never ' +
  'invent details. (2) Cite sources by their 1-based index from the SOURCES list. ' +
  '(3) If the question cannot be answered from the context, say so and do not speculate. ' +
  '(4) Keep answers concise: 2-4 sentences.'

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    citations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer' },
          outlet: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['n', 'outlet', 'url'],
      },
    },
  },
  required: ['answer', 'citations'],
}

function buildContext(story: Story): string {
  const sources = story.sources
    .map((s, i) => `[${i + 1}] ${s.outlet} — "${s.articleTitle}" ${s.url}`)
    .join('\n')

  const { institutional, reformist, skeptic } = story.lenses
  const missing = skeptic.missingNote ? `\nMissing context: ${skeptic.missingNote}` : ''

  return `STORY: ${story.headline}
SUMMARY: ${story.aiSummary}

LENS 1 — Institutional / Neutral Synthesis:
${institutional.synthesis}

LENS 2 — Reformist / Divergence:
${reformist.summary}
Agreements: ${reformist.agreements.join(' | ')}
Divergences: ${reformist.divergences.join(' | ')}

LENS 3 — Skeptic / Bias & Validity:
${skeptic.summary}
Validity: ${skeptic.validityScore}/100 — ${skeptic.validityRationale}${missing}

SOURCES (cite by number):
${sources}`
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  let question: string, story: Story
  try {
    ;({ question, story } = await req.json())
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!question?.trim() || !story?.id) {
    return Response.json({ error: 'question and story are required' }, { status: 400 })
  }

  const context = buildContext(story)

  const geminiBody = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [{ text: `${context}\n\nQuestion: ${question}` }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  }

  const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody),
  })

  if (!geminiRes.ok) {
    const err = await geminiRes.text()
    console.error('[chat] Gemini error:', geminiRes.status, err)
    return Response.json({ error: 'upstream error' }, { status: 502 })
  }

  const data = await geminiRes.json()
  const raw: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!raw) {
    console.error('[chat] empty Gemini response', JSON.stringify(data))
    return Response.json({ error: 'empty response' }, { status: 502 })
  }

  const parsed = JSON.parse(raw) as {
    answer: string
    citations: Array<{ n: number; outlet: string; url: string }>
  }

  return Response.json({ text: parsed.answer, citations: parsed.citations ?? [] })
}
