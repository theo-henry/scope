import type { NextRequest } from 'next/server'
import type { ChatCitation } from '@/lib/chat-types'
import {
  formatRetrievedStoriesForPrompt,
  retrieveChatStories,
  summarizeRetrievedStories,
  type RetrievedChatStory,
} from '@/lib/chat-retrieval'
import { getAllStories } from '@/lib/stories'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? ''
const MODEL = process.env.SCOPE_GEMINI_MODEL ?? 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const SYSTEM_PROMPT =
  'You are Scope\'s grounded chat assistant. You answer questions ONLY from the ' +
  'retrieved synthesized story context provided. Rules: (1) Use ONLY facts present ' +
  'in the context — never invent details. (2) Cite every factual answer with storyId ' +
  'and, when a specific source supports the claim, that source\'s 1-based sourceIndex. ' +
  '(3) If the question cannot be answered from the retrieved context, say so and do ' +
  'not speculate. (4) Keep answers concise: 2-4 sentences.'

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    citations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          storyId: { type: 'string' },
          storySlug: { type: 'string' },
          storyHeadline: { type: 'string' },
          sourceIndex: { type: 'integer' },
          outlet: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['storyId', 'storySlug', 'storyHeadline'],
      },
    },
  },
  required: ['answer', 'citations'],
}

interface ChatRequestBody {
  question?: unknown
  storyId?: unknown
  story?: { id?: unknown }
}

interface RawCitation {
  storyId?: unknown
  storySlug?: unknown
  storyHeadline?: unknown
  sourceIndex?: unknown
  outlet?: unknown
  url?: unknown
}

function sanitizeCitations(
  rawCitations: RawCitation[],
  results: RetrievedChatStory[],
  answer: string,
): ChatCitation[] {
  const storyById = new Map(results.map(({ story }) => [story.id, story]))
  const storyBySlug = new Map(results.map(({ story }) => [story.slug, story]))
  const citations: ChatCitation[] = []
  const seen = new Set<string>()

  for (const raw of rawCitations) {
    const storyId = typeof raw.storyId === 'string' ? raw.storyId : undefined
    const storySlug = typeof raw.storySlug === 'string' ? raw.storySlug : undefined
    const story = (storyId && storyById.get(storyId)) || (storySlug && storyBySlug.get(storySlug))
    if (!story) continue

    const sourceIndex =
      typeof raw.sourceIndex === 'number' && Number.isInteger(raw.sourceIndex)
        ? raw.sourceIndex
        : undefined
    const source =
      sourceIndex && sourceIndex >= 1 && sourceIndex <= story.sources.length
        ? story.sources[sourceIndex - 1]
        : undefined
    const key = `${story.id}:${sourceIndex ?? 'story'}`
    if (seen.has(key)) continue
    seen.add(key)

    citations.push({
      storyId: story.id,
      storySlug: story.slug,
      storyHeadline: story.headline,
      ...(source
        ? {
            sourceIndex,
            outlet: source.outlet,
            url: source.url,
          }
        : {}),
    })
  }

  if (citations.length === 0 && results.length > 0 && !isAbstention(answer)) {
    citations.push({
      storyId: results[0].story.id,
      storySlug: results[0].story.slug,
      storyHeadline: results[0].story.headline,
    })
  }

  return citations
}

function isAbstention(answer: string): boolean {
  return /cannot|can't|couldn't|insufficient|not enough|not in|not provided/i.test(answer)
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  let body: ChatRequestBody
  try {
    body = (await req.json()) as ChatRequestBody
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const question = typeof body.question === 'string' ? body.question.trim() : ''
  const storyId =
    typeof body.storyId === 'string'
      ? body.storyId
      : typeof body.story?.id === 'string'
        ? body.story.id
        : undefined

  if (!question) {
    return Response.json({ error: 'question is required' }, { status: 400 })
  }

  const stories = await getAllStories()
  const retrievedStories = retrieveChatStories(stories, question, storyId)

  if (retrievedStories.length === 0) {
    return Response.json({
      text:
        "I couldn't find enough in the synthesized story summaries to answer that. Try asking about a specific topic, outlet, country, or story.",
      citations: [],
      retrievedStories: [],
    })
  }

  const context = formatRetrievedStoriesForPrompt(retrievedStories)

  const geminiBody = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `${context}\n\nQuestion: ${question}\n\n` +
              'Return citations using storyId from the retrieved story and sourceIndex when citing a listed source.',
          },
        ],
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

  let parsed: { answer: string; citations: RawCitation[] }
  try {
    parsed = JSON.parse(raw) as { answer: string; citations: RawCitation[] }
  } catch (err) {
    console.error('[chat] invalid Gemini JSON', err, raw)
    return Response.json({ error: 'invalid upstream response' }, { status: 502 })
  }

  const answer = typeof parsed.answer === 'string' ? parsed.answer : ''
  const citations = sanitizeCitations(parsed.citations ?? [], retrievedStories, answer)

  return Response.json({
    text: answer,
    citations,
    retrievedStories: summarizeRetrievedStories(retrievedStories),
  })
}
