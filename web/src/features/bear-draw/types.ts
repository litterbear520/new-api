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
import type { DrawErrorKind, DrawImage } from '@/features/draw/types'

/*
 * The drawing page as a design agent (Lovart style). A project is one
 * conversation plus its canvas. The agent is a chat model on
 * /pg/chat/completions with tools; pictures come from /v1/images with the
 * page's 「网页画图」 token, exactly like the classic page.
 */

/**
 * Every message goes to the planner now ('agent'). 'image' stays for
 * messages from before 2026-11-26, sent in the old Image mode.
 */
export type Mode = 'agent' | 'image'

/** Aspect ratios the image models follow when the prompt names them. */
export type Ratio =
  | 'auto'
  | '1:1'
  | '3:4'
  | '4:3'
  | '2:3'
  | '3:2'
  | '9:16'
  | '16:9'

/** A picture in this browser's IndexedDB (the classic page's image store). */
export type ImageRef = DrawImage

/** A picture attached to a message: uploaded, pasted, or taken from the canvas with @. */
export type Attachment = ImageRef & {
  name?: string
  /** Taken from this canvas node. */
  nodeId?: string
  /** The node's label, shown as "@首图". */
  label?: string
  /** A copy of the node with the red marks drawn on it (圈选). */
  marked?: boolean
  /** Where each red mark is: its centre in percent of the picture. */
  spots?: Array<{ n: number; x: number; y: number }>
}

/** What the composer remembers between visits (localStorage). */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh'

export type Prefs = {
  /**
   * 「最新」: the planner is the page's current default. Picking a planner
   * by hand turns it off.
   */
  auto: boolean
  /** Chat model that plans. */
  brain: string
  /** How long the planner thinks (sent as reasoning_effort). */
  effort: Effort
  /**
   * Image model for every picture. Not the user's choice: the recommended
   * one, or the first the account has.
   */
  image: string
  /** Apply the brand kit. */
  brand: boolean
}

export type BrandKit = {
  name: string
  /** Hex colours, main colour first. */
  colors: string[]
  fonts: string
  tone: string
  /** Selling points the agent may use. */
  points: string[]
  logo: ImageRef | null
  notes: string
}

/* ------------------------------------------------------------------ */
/* Skills and the 玩法 gallery (static data in data/)                  */
/* ------------------------------------------------------------------ */

export type SkillCategory = 'ecom' | 'brand' | 'social' | 'ads' | 'pack'

export type SkillQuestion = {
  q: string
  multi: boolean
  options: string[]
  /** The card offers a free-text "other" answer. */
  other: boolean
}

export type Deliverable = {
  label: string
  ratio: Ratio
  /** Delivery size, e.g. "800×800"; export crops to it. */
  size: string
  model?: string
  note?: string
}

export type SkillSource = {
  repo: string
  path: string
  license: string
  stars?: number
  url: string
  used?: string
}

export type Skill = {
  id: string
  name: string
  tagline: string
  description: string
  /** Built-in category; skills the user added are 'mine'. */
  category: SkillCategory | 'mine'
  platforms: string[]
  author: string
  starters: string[]
  questions: SkillQuestion[]
  deliverables: Deliverable[]
  /** Cover picture URLs (built-in skills only). */
  covers: string[]
  sources: SkillSource[]
  /** User skills keep their SKILL.md here; built-in ones load it on demand. */
  text?: string
  mine?: boolean
  createdAt?: number
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export type NodeStatus = 'pending' | 'ready' | 'failed' | 'stopped'

/** A picture on the canvas. Pending nodes are frames waiting for their picture. */
export type CanvasNode = {
  id: string
  groupId: string | null
  status: NodeStatus
  img?: ImageRef
  /** Size of the picture, or of the frame while it waits. */
  w: number
  h: number
  /** Width shown on the canvas when the user resized it. */
  dw?: number
  /** World position for nodes outside a group. */
  x?: number
  y?: number
  label: string
  meta: {
    model?: string
    cost?: number
    secs?: number
    /** The description it was drawn from. */
    prompt?: string
    startedAt?: number
    /** Delivery size, e.g. "800×800"; export crops to it. */
    size?: string
    /** Uploaded by the user (not drawn). */
    upload?: boolean
    /** The canvas picture this one was edited from. */
    parentId?: string
  }
}

/** A frame on the canvas holding one set of pictures. */
export type CanvasGroup = {
  id: string
  title: string
  subtitle?: string
  /** Platform name used for export file names, e.g. 淘宝. */
  platform?: string
  x?: number
  y?: number
  children: string[]
}

export type CanvasCamera = { x: number; y: number; s: number }

/** A line of UI text, translated when shown: t(key, params). */
export type Phrase = { key: string; params?: Record<string, string | number> }

export type StatusIcon =
  | 'book'
  | 'scan'
  | 'brand'
  | 'plan'
  | 'think'
  | 'swap'
  | 'info'

export type QuestionItem = {
  q: string
  options: string[]
  multi?: boolean
  /** Allow a free-text answer. */
  other?: boolean
}

export type QuestionAnswer = { q: string; answer: string }

/** What an input picture is for. */
export type InputRole =
  | 'edit_target'
  | 'product_ref'
  | 'style_ref'
  | 'logo_ref'
  | 'scene_ref'
  | 'insert'

/** One input picture of a plan item: a canvas node or a "Picture n" of the user. */
export type PlanInput = { node?: string; ref?: number; role: InputRole }

export type PlanItem = {
  /** The user changed its words on the plan card. */
  edited?: boolean
  id: string
  label: string
  /** The full description sent to the image model (without the ratio hint). */
  prompt: string
  ratio: Ratio
  /** Delivery size, e.g. "800×800". */
  size?: string
  model: string
  transparent?: boolean
  /** 1-based indexes of the pictures attached to the user's message. */
  refs?: number[]
  /** Canvas node to edit. */
  base?: string
  /** Every input picture with its role, in order; replaces base + refs. */
  inputs?: PlanInput[]
  note?: string
  /** Estimated USD. */
  est: number
  /** Unticked items are not drawn. */
  on: boolean
}

/** A word the advertising law forbids, found in a plan's in-picture text. */
export type AdLawHit = {
  itemId: string
  word: string
  fix: string
  /** Why it is risky, from data/ad-law. */
  reason?: string
}

export type ProgressStatus =
  | 'queued'
  | 'drawing'
  | 'done'
  | 'failed'
  | 'stopped'
  | 'lost'

export type ProgressItem = {
  id: string
  nodeId: string
  label: string
  size?: string
  model: string
  prompt: string
  status: ProgressStatus
  startedAt?: number
  secs?: number
  cost?: number
  img?: ImageRef
  edit?: boolean
  error?: { kind: DrawErrorKind; message?: string }
  /** What was sent, kept so a failed picture can be drawn again. */
  job?: PictureJob
}

/** One request to the image model. */
export type PictureJob = {
  model: string
  /** The final prompt, ratio sentence included. */
  prompt: string
  transparent: boolean
  /** Stored pictures sent with it, in order (edits). */
  inputs: string[]
  ratio: Ratio
}

export type BrainErrorKind =
  | 'model'
  | 'balance'
  | 'login'
  | 'busy'
  | 'long'
  | 'blocked'
  | 'vision'
  | 'upstream'
  | 'network'
  | 'other'

export type Part =
  | {
      id: string
      type: 'status'
      icon: StatusIcon
      text: Phrase
      live?: boolean
    }
  | { id: string; type: 'text'; text: string; streaming?: boolean }
  | {
      id: string
      type: 'questions'
      callId: string
      intro?: string
      items: QuestionItem[]
      answers: QuestionAnswer[] | null
      skipped?: boolean
    }
  | {
      id: string
      type: 'plan'
      callId: string
      title: string
      platform?: string
      note?: string
      items: PlanItem[]
      /**
       * pending: waits for 开始画; auto: started without asking (small plan);
       * confirmed: the user started it; cancelled: stopped or declined;
       * changed: the user typed something else instead.
       */
      state: 'pending' | 'auto' | 'confirmed' | 'cancelled' | 'changed'
      adlaw: AdLawHit[]
      /** The user replaced the flagged words. */
      adlawFixed?: boolean
      /** The prompts 「全部替换」 changed, by item id: 撤销 puts them back. */
      adlawUndo?: Record<string, string>
    }
  | {
      id: string
      type: 'progress'
      groupId: string
      items: ProgressItem[]
      /** Image mode: no headline. */
      compact?: boolean
    }
  | {
      id: string
      type: 'result'
      done: number
      failed: number
      stopped: number
      cost: number
      secs: number
      groupId?: string
      suggestions: string[]
      compact?: boolean
    }
  | {
      id: string
      type: 'error'
      kind: BrainErrorKind
      message?: string
      model?: string
    }

export type PartType = Part['type']

export type UserMessage = {
  id: string
  role: 'user'
  at: number
  mode: Mode
  text: string
  refs: Attachment[]
  /** Typed as the answer to a waiting question or plan card. */
  reply?: boolean
  skillId?: string
  /** The brand kit was applied. */
  brand?: boolean
  /** Sent from a 玩法 card, with the card's title. */
  presetId?: string
  presetTitle?: string
  /** The ratio picked for this message; left out when the planner chooses. */
  ratio?: Ratio
  /** Messages from before 2026-11-26, sent in the old Image mode. */
  image?: { model: string; ratio: Ratio; count: number; transparent: boolean }
}

export type AgentStatus =
  | 'running'
  | 'waiting'
  | 'done'
  | 'stopped'
  | 'error'
  | 'lost'

export type AgentMessage = {
  id: string
  role: 'agent'
  mode: Mode
  parts: Part[]
  status: AgentStatus
  startedAt: number
  endedAt?: number
  /** USD: thinking + pictures. */
  cost: number
  /** The chat model that answered (Agent mode). */
  brain?: string
  /** "↳" follow-ups from suggest_next, shown under the result. */
  suggestions?: string[]
}

export type Message = UserMessage | AgentMessage

/** One message of the planner's own conversation (OpenAI chat format). */
export type ApiToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type ApiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type ApiMessage =
  | {
      role: 'user'
      content: string
      images?: string[]
      /**
       * Pictures the page shows the planner after a tool result (it asked to
       * see them, or they were just drawn), not words of the user.
       */
      shown?: boolean
      /** Long side these pictures are sent at (default PLANNER_PICTURE_PX). */
      px?: number
    }
  | {
      role: 'assistant'
      content: string | null
      tool_calls?: ApiToolCall[]
    }
  | { role: 'tool'; tool_call_id: string; content: string }

/** What a project page shows: the chat beside the canvas, or one of them. */
export type ProjectLayout = 'split' | 'chat' | 'canvas'

export type Project = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  /** USD spent in this project. */
  cost: number
  messages: Message[]
  /**
   * The planner's conversation. User turns keep image ids (not data URLs);
   * they are turned into small JPEGs when sent.
   */
  transcript: ApiMessage[]
  groups: CanvasGroup[]
  nodes: CanvasNode[]
  camera?: CanvasCamera | null
  /** Chat and canvas, chat only or canvas only (remembered; unset = chat only). */
  layout?: ProjectLayout
  /** Copied from the classic drawing page. */
  migrated?: boolean
  /** The title came from the first message; the first plan may rename it. */
  autoTitle?: boolean
}

/** A project's live work, kept in memory only. */
export type LiveState = {
  /** What the agent is doing right now. */
  phase: 'think' | 'skill' | 'look' | 'write' | 'plan' | 'draw' | 'wait'
  /** Start of this stretch of work (resets after waiting for the user). */
  since: number
  /** Start of the current phase. */
  phaseSince?: number
  /** The model being asked. */
  model?: string
}
