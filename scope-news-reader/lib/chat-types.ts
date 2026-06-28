export interface ChatCitation {
  storyId: string
  storySlug: string
  storyHeadline: string
  /** 1-based index into the cited story's source list */
  sourceIndex?: number
  outlet?: string
  url?: string
}

export interface ChatRetrievedStory {
  id: string
  slug: string
  headline: string
}

export interface ChatResponse {
  text: string
  citations: ChatCitation[]
  retrievedStories: ChatRetrievedStory[]
}
