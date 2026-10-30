/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/** A picture the user attached, downscaled in the browser and sent inline. */
export type ChatImage = {
  id: string
  /** data: URL (JPEG/PNG/WebP), sent as `image_url`. */
  url: string
  name?: string
  w: number
  h: number
}

export type ChatUsage = {
  prompt: number
  completion: number
  total: number
  /** Prompt tokens read from the cache. */
  cached?: number
  reasoning?: number
}

export type ReasoningEffort = 'low' | 'medium' | 'high'

export type ReplyStatus = 'waiting' | 'streaming' | 'done' | 'stopped' | 'error'

export type ReplyError = {
  message: string
  code?: string
  status?: number
  /** Nothing came back, so the request was not billed. */
  unbilled?: boolean
}

/** One answer from one model; retrying adds another to the same turn. */
export type Reply = {
  id: string
  model: string
  content: string
  reasoning?: string
  status: ReplyStatus
  startedAt: number
  /** First reasoning or text token. */
  firstAt?: number
  /** First text token, i.e. when the thinking ended. */
  textAt?: number
  endedAt?: number
  usage?: ChatUsage
  /** Estimated USD from the usage and the model price; null when unknown. */
  cost?: number | null
  error?: ReplyError
  finish?: string
  effort?: ReasoningEffort
}

export type UserTurn = {
  id: string
  role: 'user'
  text: string
  images?: ChatImage[]
  at: number
}

export type AssistantTurn = {
  id: string
  role: 'assistant'
  replies: Reply[]
  /** Index of the reply on show. */
  cur: number
}

export type ChatTurn = UserTurn | AssistantTurn

export type Conversation = {
  id: string
  title: string
  /** The user renamed it, so automatic titles leave it alone. */
  named?: boolean
  createdAt: number
  updatedAt: number
  system?: string
  turns: ChatTurn[]
}

/** Optional request parameters; null means "use the model default" (not sent). */
export type ChatParams = {
  temperature: number | null
  top_p: number | null
  max_tokens: number | null
  effort: ReasoningEffort | null
}

export type BearMood = 'live' | 'quiet' | 'hide'

export type ChatSettings = {
  model: string
  group: string
  params: ChatParams
  mood: BearMood
  /** Width of the artifact panel in px; 0 = half the card. */
  panelW: number
}

export type ArtifactKind = 'html' | 'svg' | 'code'

/** A long or previewable code block in a reply, shown in the side panel. */
export type Artifact = {
  /** `${replyId}:${n}`, stable while the reply streams. */
  id: string
  replyId: string
  kind: ArtifactKind
  /** Normalised language, e.g. html, python. */
  lang: string
  code: string
  /** The closing fence arrived. */
  closed: boolean
  title: string
  /** Suggested file name for downloads. */
  file: string
}

export type ReplySegment =
  | { type: 'text'; text: string; key: string }
  | { type: 'artifact'; artifact: Artifact; key: string }
