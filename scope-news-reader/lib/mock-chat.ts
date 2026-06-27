import type { Story } from './types'

export interface Citation {
  /** 1-based index into the story's source list */
  n: number
  outlet: string
  url: string
}

export interface MockAnswer {
  text: string
  citations: Citation[]
}

// A stand-in for the future grounded RAG route (api/chat). It only "answers"
// from the loaded story's sources and cites them; otherwise it abstains.
// Real implementation: retrieve top-k article chunks -> generate with a
// cite-or-abstain guardrail -> stream tokens via the Vercel AI SDK.
export function mockAnswer(question: string, story: Story | null): MockAnswer {
  if (!story) {
    return {
      text: 'Open a story first — I answer only from the outlets covering the article currently in view, and cite each one.',
      citations: [],
    }
  }

  const q = question.toLowerCase()
  const cite = (idxs: number[]): Citation[] =>
    idxs
      .filter((i) => i >= 0 && i < story.sources.length)
      .map((i) => ({
        n: i + 1,
        outlet: story.sources[i].outlet,
        url: story.sources[i].url,
      }))

  if (/(differ|disagree|diverge|split|conflict)/.test(q)) {
    return {
      text:
        `Across the ${story.sources.length} outlets, the main disagreements are: ` +
        story.lenses.reformist.divergences
          .map((d) => `(${d.toLowerCase().replace(/\.$/, '')})`)
          .join('; ') +
        `. The framing splits most clearly between ${story.sources[0].outlet} and ${story.sources[story.sources.length - 1].outlet}.`,
      citations: cite([0, story.sources.length - 1, 1]),
    }
  }

  if (/(agree|same|common|consensus|all)/.test(q)) {
    return {
      text:
        'Every covering outlet agrees on these points: ' +
        story.lenses.reformist.agreements.map((a) => a.replace(/\.$/, '')).join('; ') +
        '.',
      citations: cite([0, 1, 2]),
    }
  }

  if (/(valid|trust|reliab|confiden|score)/.test(q)) {
    return {
      text: `This story scores ${story.lenses.skeptic.validityScore}/100. ${story.lenses.skeptic.validityRationale}`,
      citations: cite([0, 1]),
    }
  }

  if (/(bias|lean|left|right|spectrum)/.test(q)) {
    const left = story.sources.filter((s) => /left/.test(s.biasLean)).length
    const right = story.sources.filter((s) => /right/.test(s.biasLean)).length
    return {
      text: `Of the covering outlets, ${left} lean left, ${right} lean right, and the rest sit center. Reliability ranges from ${Math.min(
        ...story.sources.map((s) => s.reliability),
      )} to ${Math.max(...story.sources.map((s) => s.reliability))}.`,
      citations: cite(story.sources.map((_, i) => i).slice(0, 3)),
    }
  }

  if (/(summary|what happened|explain|about|overview|tldr)/.test(q)) {
    return { text: story.lenses.institutional.synthesis, citations: cite([0, 1, 2]) }
  }

  // Cite-or-abstain guardrail.
  return {
    text:
      `That isn't covered in the ${story.sources.length} articles loaded for this story, so I won't guess. ` +
      `I can compare how the outlets differ, summarize the consensus, or explain the validity score.`,
    citations: [],
  }
}

export const SUGGESTED_QUESTIONS = [
  'How do sources differ on this?',
  'What do all outlets agree on?',
  'Why this validity score?',
]
