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
export type DrawRatio = 'auto' | 'square' | 'land' | 'port'

/** One free-hand stroke in picture coordinates (0–1); a tap is a numbered pin. */
export type MarkStroke = Array<[number, number]>

/** A picture kept in this browser's IndexedDB; `id` keys the stored blobs. */
export type DrawImage = {
  id: string
  w: number
  h: number
  clear?: boolean
}

export type AttachmentKind = 'base' | 'mark' | 'ref'

export type DrawAttachment = DrawImage & {
  kind: AttachmentKind
  name?: string
}

export type DrawRequest = {
  text: string
  imgs: DrawAttachment[]
  ratio: DrawRatio
  clear: boolean
  model: string
  marks: MarkStroke[] | null
}

export type DrawErrorKind =
  | 'moderation'
  | 'busy'
  | 'balance'
  | 'auth'
  | 'lost'
  | 'unreadable'
  | 'other'

export type DrawItem = {
  id: string
  req: DrawRequest
  /** The picture this one was edited from. */
  parent: string | null
  start: number
  status: 'pending' | 'done' | 'error'
  /** Estimated cost in USD, held back from the balance while drawing. */
  est: number
  img?: DrawImage
  secs?: number
  /** Billed cost in USD, from the usage the API returned. */
  cost?: number
  error?: { kind: DrawErrorKind; message?: string }
  /** When the picture arrived; drives the ripple in the chat. Not stored. */
  rv?: number
  /** When the picture first showed on the canvas; drives the canvas ripple. Not stored. */
  cvAt?: number
  /** Finished while another picture was on the canvas. */
  unseen?: boolean
  /** "↳ 接着改" follow-up suggestions. */
  sugs?: string[]
  /** One of the pictures a request was split into: ① 红格纹款. */
  part?: { i: number; title: string }
  /** The description the image model actually used (upstream revised_prompt). */
  revised?: string
  /** Waiting for a free drawing slot; nothing has been sent or charged yet. */
  queued?: boolean
}

export type DrawPlanPart = { title: string; text: string }

/**
 * How a request was split into separate pictures.
 * planning: the planner is working; confirm: 3 or more pictures wait for
 * 开始画; drawn: the pictures were started; stale: the page closed while
 * planning, so nothing was drawn.
 */
export type DrawPlan = {
  status: 'planning' | 'confirm' | 'drawn' | 'stale'
  parts: DrawPlanPart[]
  /** The user asked for more pictures than one request may make. */
  capped?: boolean
}

export type DrawUserMessage = {
  id: string
  role: 'user'
  text: string
  imgs: DrawAttachment[]
  ratio: DrawRatio
  clear: boolean
}

export type DrawResultMessage = {
  id: string
  role: 'ai'
  items: DrawItem[]
  plan?: DrawPlan
  /** The request as sent, kept while a plan waits; with its estimate per picture. */
  req?: DrawRequest
  est?: number
  parent?: string | null
}

export type DrawMessage = DrawUserMessage | DrawResultMessage

export type DrawMark = {
  item: string
  img: DrawImage
  strokes: MarkStroke[]
}

export type DrawRoom = {
  id: string
  title: string
  model: string
  /** Last activity, ms. */
  t: number
  msgs: DrawMessage[]
  /** Picture shown on the canvas. */
  sel?: string | null
  /** The user chose to draw a new picture instead of editing the selected one. */
  detached?: boolean
  mark?: DrawMark | null
  /** A new conversation that has not been sent yet; never stored. */
  fresh?: boolean
}

export type DrawUsage = {
  input_tokens?: number
  output_tokens?: number
  input_tokens_details?: {
    text_tokens?: number
    image_tokens?: number
    cached_tokens?: number
  }
}

export type DrawModelOption = {
  id: string
  name: string
  tag?: string
  desc?: string
}

export type DrawAlertPrefs = {
  notify: boolean
  sound: boolean
}
