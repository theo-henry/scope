import type { ChatRetrievedStory } from './chat-types'
import type { Story } from './types'

export interface RetrievedChatStory {
  story: Story
  score: number
}

const MAX_RETRIEVED_STORIES = 3
const MIN_RELEVANCE_SCORE = 4
const FOCUSED_STORY_BOOST = 12

const STOPWORDS = new Set([
  'a',
  'about',
  'all',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'do',
  'does',
  'for',
  'from',
  'has',
  'have',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'of',
  'on',
  'or',
  'our',
  'should',
  'that',
  'the',
  'their',
  'this',
  'to',
  'was',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
])

const OVERVIEW_TERMS = new Set([
  'biggest',
  'current',
  'headlines',
  'latest',
  'newest',
  'now',
  'recent',
  'right',
  'stories',
  'story',
  'today',
  'top',
])

const RELATED_TERMS = new Set([
  'compare',
  'connected',
  'else',
  'other',
  'related',
  'similar',
])

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function tokenize(value: string): string[] {
  const seen = new Set<string>()
  return normalize(value)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .filter((token) => {
      if (seen.has(token)) return false
      seen.add(token)
      return true
    })
}

function countMatches(text: string, terms: string[]): number {
  if (!text || terms.length === 0) return 0
  const normalized = ` ${normalize(text)} `
  return terms.reduce((sum, term) => {
    const pattern = new RegExp(` ${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `, 'g')
    return sum + (normalized.match(pattern)?.length ?? 0)
  }, 0)
}

function fieldScore(text: string, terms: string[], weight: number): number {
  return countMatches(text, terms) * weight
}

function storySearchFields(story: Story) {
  const { institutional, reformist, skeptic } = story.lenses
  return {
    headline: story.headline,
    summary: story.aiSummary,
    lenses: [
      institutional.synthesis,
      reformist.summary,
      reformist.agreements.join(' '),
      reformist.divergences.join(' '),
      skeptic.summary,
      skeptic.validityRationale,
      skeptic.missingNote ?? '',
    ].join(' '),
    sourceTitles: story.sources.map((source) => source.articleTitle).join(' '),
    sourceOutlets: story.sources.map((source) => source.outlet).join(' '),
    metadata: `${story.category} ${story.country}`,
  }
}

function scoreStory(story: Story, terms: string[], phrase: string): number {
  const fields = storySearchFields(story)
  let score = 0

  score += fieldScore(fields.headline, terms, 8)
  score += fieldScore(fields.sourceTitles, terms, 6)
  score += fieldScore(fields.summary, terms, 4)
  score += fieldScore(fields.lenses, terms, 3)
  score += fieldScore(fields.metadata, terms, 4)
  score += fieldScore(fields.sourceOutlets, terms, 2)

  if (phrase.length > 3) {
    const normalizedPhrase = normalize(phrase)
    if (normalize(fields.headline).includes(normalizedPhrase)) score += 20
    if (normalize(fields.sourceTitles).includes(normalizedPhrase)) score += 14
    if (normalize(fields.summary).includes(normalizedPhrase)) score += 10
  }

  return score
}

function dateValue(story: Story): number {
  const value = new Date(story.publishedAt).getTime()
  return Number.isFinite(value) ? value : 0
}

function isOverviewQuestion(terms: string[], focusedStoryId?: string): boolean {
  if (focusedStoryId) return false
  return terms.length > 0 && terms.every((term) => OVERVIEW_TERMS.has(term))
}

function isRelatedQuestion(terms: string[], focusedStoryId?: string): boolean {
  if (!focusedStoryId) return false
  return terms.some((term) => RELATED_TERMS.has(term))
}

function relationshipScore(candidate: Story, focused: Story): number {
  if (candidate.id === focused.id) return 100

  const candidateDomains = new Set(candidate.sources.map((source) => source.domain))
  const focusedDomains = new Set(focused.sources.map((source) => source.domain))
  const sharedDomains = [...candidateDomains].filter((domain) =>
    focusedDomains.has(domain),
  ).length

  let score = 0
  if (candidate.category === focused.category) score += 12
  if (candidate.country === focused.country) score += 6
  score += sharedDomains * 3
  score += countMatches(candidate.headline, tokenize(focused.headline)) * 0.5
  return score
}

export function retrieveChatStories(
  stories: Story[],
  question: string,
  focusedStoryId?: string,
): RetrievedChatStory[] {
  const terms = tokenize(question)
  const focusedStory = focusedStoryId
    ? stories.find((story) => story.id === focusedStoryId)
    : undefined

  if (isOverviewQuestion(terms, focusedStoryId)) {
    return [...stories]
      .sort((a, b) => dateValue(b) - dateValue(a))
      .slice(0, MAX_RETRIEVED_STORIES)
      .map((story, index) => ({ story, score: MAX_RETRIEVED_STORIES - index }))
  }

  if (focusedStory && isRelatedQuestion(terms, focusedStoryId)) {
    return [...stories]
      .map((story) => ({ story, score: relationshipScore(story, focusedStory) }))
      .filter((result) => result.score > 0)
      .sort(compareResults)
      .slice(0, MAX_RETRIEVED_STORIES)
  }

  const results = stories
    .map((story) => {
      const focusBoost = story.id === focusedStoryId ? FOCUSED_STORY_BOOST : 0
      return {
        story,
        score: scoreStory(story, terms, question) + focusBoost,
      }
    })
    .filter((result) => result.score >= MIN_RELEVANCE_SCORE)
    .sort(compareResults)
    .slice(0, MAX_RETRIEVED_STORIES)

  if (results.length === 0 && focusedStory) {
    return [{ story: focusedStory, score: FOCUSED_STORY_BOOST }]
  }

  return results
}

function compareResults(a: RetrievedChatStory, b: RetrievedChatStory): number {
  if (b.score !== a.score) return b.score - a.score
  return dateValue(b.story) - dateValue(a.story)
}

export function formatRetrievedStoriesForPrompt(results: RetrievedChatStory[]): string {
  return results
    .map(({ story }, index) => {
      const { institutional, reformist, skeptic } = story.lenses
      const missing = skeptic.missingNote
        ? `\nMissing context: ${skeptic.missingNote}`
        : ''
      const sources = story.sources
        .map(
          (source, sourceIndex) =>
            `[${sourceIndex + 1}] ${source.outlet} — "${source.articleTitle}" ${source.url}`,
        )
        .join('\n')

      return `RETRIEVED STORY ${index + 1}
Story ID: ${story.id}
Story slug: ${story.slug}
Story headline: ${story.headline}
Category/Country: ${story.category} / ${story.country}
Summary: ${story.aiSummary}

Institutional synthesis:
${institutional.synthesis}

Reformist synthesis:
${reformist.summary}
Agreements: ${reformist.agreements.join(' | ')}
Divergences: ${reformist.divergences.join(' | ')}

Skeptic synthesis:
${skeptic.summary}
Validity: ${skeptic.validityScore}/100 — ${skeptic.validityRationale}${missing}

Sources for this story, cited by sourceIndex:
${sources}`
    })
    .join('\n\n---\n\n')
}

export function summarizeRetrievedStories(
  results: RetrievedChatStory[],
): ChatRetrievedStory[] {
  return results.map(({ story }) => ({
    id: story.id,
    slug: story.slug,
    headline: story.headline,
  }))
}
