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
import type {
  AssistantTurn,
  ChatParams,
  Conversation,
  ReasoningEffort,
  Reply,
  UserTurn,
} from '../types'
import { splitThink } from './artifacts'

export type ApiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type ApiMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | ApiContentPart[]
}

export type ChatRequestBody = {
  model: string
  group?: string
  messages: ApiMessage[]
  stream: true
  stream_options: { include_usage: true }
  temperature?: number
  top_p?: number
  max_tokens?: number
  reasoning_effort?: ReasoningEffort
}

export function currentReply(turn: AssistantTurn): Reply | undefined {
  return turn.replies[turn.cur] ?? turn.replies.at(-1)
}

/** What the model said in a reply, as history for the next request. */
export function replyHistoryText(reply: Reply | undefined): string {
  if (!reply || reply.status === 'error') return ''
  return splitThink(reply.content).text.trim()
}

function userParts(turn: UserTurn): ApiContentPart[] {
  const parts: ApiContentPart[] = []
  if (turn.text.trim()) parts.push({ type: 'text', text: turn.text })
  for (const img of turn.images ?? []) {
    parts.push({ type: 'image_url', image_url: { url: img.url } })
  }
  return parts
}

function toContent(parts: ApiContentPart[]): string | ApiContentPart[] {
  if (parts.length === 1 && parts[0].type === 'text') return parts[0].text
  return parts
}

/**
 * The messages for the reply at `turns[upto]`: the system prompt, then every
 * turn before it. Failed or empty replies are left out, and the user turns
 * around them are merged, because some providers refuse two user messages
 * in a row.
 */
export function buildMessages(conv: Conversation, upto: number): ApiMessage[] {
  const out: ApiMessage[] = []
  const system = conv.system?.trim()
  if (system) out.push({ role: 'system', content: system })
  let pending: ApiContentPart[] | null = null
  const end = Math.min(upto, conv.turns.length)
  for (let i = 0; i < end; i++) {
    const turn = conv.turns[i]
    if (turn.role === 'user') {
      const parts = userParts(turn)
      if (!pending) {
        pending = parts
      } else {
        const joined: ApiContentPart[] = pending
        if (parts.length) {
          joined.push({ type: 'text', text: '\n\n' })
          joined.push(...parts)
        }
      }
      continue
    }
    const text = replyHistoryText(currentReply(turn))
    if (!text) continue
    if (pending?.length) out.push({ role: 'user', content: toContent(pending) })
    pending = null
    out.push({ role: 'assistant', content: text })
  }
  if (pending?.length) out.push({ role: 'user', content: toContent(pending) })
  return out
}

export function buildBody(opts: {
  conv: Conversation
  upto: number
  model: string
  group: string
  params: ChatParams
}): ChatRequestBody {
  const body: ChatRequestBody = {
    model: opts.model,
    messages: buildMessages(opts.conv, opts.upto),
    stream: true,
    stream_options: { include_usage: true },
  }
  if (opts.group) body.group = opts.group
  const p = opts.params
  if (p.temperature != null) body.temperature = p.temperature
  if (p.top_p != null) body.top_p = p.top_p
  if (p.max_tokens != null) body.max_tokens = p.max_tokens
  if (p.effort != null) body.reasoning_effort = p.effort
  return body
}

/** The same request with the pictures shortened, for showing to people. */
export function redactImages(body: ChatRequestBody): ChatRequestBody {
  return {
    ...body,
    messages: body.messages.map((m) =>
      typeof m.content === 'string'
        ? m
        : {
            ...m,
            content: m.content.map((part) =>
              part.type === 'image_url' &&
              part.image_url.url.startsWith('data:')
                ? {
                    type: 'image_url' as const,
                    image_url: {
                      url: `${part.image_url.url.slice(0, 32)}…`,
                    },
                  }
                : part
            ),
          }
    ),
  }
}
