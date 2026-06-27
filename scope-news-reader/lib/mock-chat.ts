export interface Citation {
  /** 1-based index into the story's source list */
  n: number
  outlet: string
  url: string
}

export const SUGGESTED_QUESTIONS = [
  'How do sources differ on this?',
  'What do all outlets agree on?',
  'Why this validity score?',
]
