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
import { blobToDataUrl, smallJpeg } from '@/features/draw/lib/images'
import { getImageBlob } from '@/features/draw/lib/storage'

import type {
  ApiContentPart,
  ApiMessage,
  ApiToolCall,
  Attachment,
  Skill,
  UserMessage,
} from '../../types'

/*
 * The planner's conversation is kept in OpenAI chat format. User turns
 * store picture ids; only the newest user turn's pictures are sent (as
 * small JPEGs), older ones become a line of text, so long projects stay
 * cheap and fast to upload from China.
 */

type WireMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ApiContentPart[] }
  | {
      role: 'assistant'
      content: string | null
      tool_calls?: ApiToolCall[]
    }
  | { role: 'tool'; tool_call_id: string; content: string }

const urlCache = new Map<string, string>()

async function pictureUrl(id: string): Promise<string | null> {
  const hit = urlCache.get(id)
  if (hit) return hit
  const blob =
    (await getImageBlob(id, 'thumb')) ?? (await getImageBlob(id, 'full'))
  if (!blob) return null
  try {
    // 768 px is plenty to read a product and its label.
    const url = await blobToDataUrl(await smallJpeg(blob, 768))
    urlCache.set(id, url)
    return url
  } catch {
    return null
  }
}

/** What a picture attached to a message is, for the planner. */
export function describeRef(ref: Attachment, n: number): string {
  if (ref.marked) {
    return `Picture ${n}: the canvas picture「${ref.label ?? ''}」(${ref.nodeId ?? ''}) with red numbered circles marking where to change (a guide only).`
  }
  if (ref.nodeId) {
    return `Picture ${n}: the canvas picture「${ref.label ?? ''}」(id ${ref.nodeId}).`
  }
  return `Picture ${n}: uploaded by the user${ref.name ? ` (${ref.name})` : ''}, ${ref.w}×${ref.h}.`
}

/** The text of a user turn: the message plus what came with it. */
export function userTurnText(
  user: UserMessage,
  opts: { skill?: Skill | null; brand?: string | null }
): string {
  const lines: string[] = []
  if (opts.skill) {
    lines.push(
      `[The user picked the skill ${opts.skill.id}（${opts.skill.name}）.]`
    )
  }
  if (opts.brand) lines.push(`[Apply the brand kit「${opts.brand}」.]`)
  user.refs.forEach((ref, i) => lines.push(`[${describeRef(ref, i + 1)}]`))
  lines.push(user.text.trim() || '(no text)')
  return lines.join('\n')
}

/**
 * Every assistant tool call needs exactly one tool result, right after its
 * assistant message, before the next request. Results that ended up later
 * (work that finished after the user moved on) are moved back, duplicates
 * and orphans are dropped, and calls without one (the page closed, the user
 * stopped) get a short "interrupted" result.
 */
export function repairTranscript(list: ApiMessage[]): ApiMessage[] {
  const results = new Map<string, Extract<ApiMessage, { role: 'tool' }>>()
  for (const m of list) {
    if (m.role === 'tool' && !results.has(m.tool_call_id)) {
      results.set(m.tool_call_id, m)
    }
  }
  const out: ApiMessage[] = []
  for (const m of list) {
    if (m.role === 'tool') continue
    out.push(m)
    if (m.role !== 'assistant' || !m.tool_calls?.length) continue
    for (const call of m.tool_calls) {
      out.push(
        results.get(call.id) ?? {
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ status: 'interrupted' }),
        }
      )
    }
  }
  return out
}

/**
 * Puts a tool result right after the assistant message that made the call
 * (or replaces the one already there); an unknown call is ignored.
 */
export function placeToolResult(
  list: ApiMessage[],
  callId: string,
  content: string
): ApiMessage[] {
  const result: ApiMessage = { role: 'tool', tool_call_id: callId, content }
  const at = list.findIndex(
    (m) => m.role === 'tool' && m.tool_call_id === callId
  )
  if (at >= 0) return list.map((m, i) => (i === at ? result : m))
  const ai = list.findIndex(
    (m) => m.role === 'assistant' && m.tool_calls?.some((c) => c.id === callId)
  )
  if (ai < 0) return list
  let j = ai + 1
  while (j < list.length && list[j].role === 'tool') j++
  return [...list.slice(0, j), result, ...list.slice(j)]
}

/** Tool calls of the last assistant message that have no result yet. */
export function openCalls(list: ApiMessage[]): string[] {
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]
    if (m.role === 'user') return []
    if (m.role !== 'assistant') continue
    const answered = new Set(
      list
        .slice(i + 1)
        .filter(
          (x): x is Extract<ApiMessage, { role: 'tool' }> => x.role === 'tool'
        )
        .map((x) => x.tool_call_id)
    )
    return (m.tool_calls ?? [])
      .map((c) => c.id)
      .filter((id) => !answered.has(id))
  }
  return []
}

/** The request messages: system prompt + transcript, pictures of the newest user turn inlined. */
export async function wireMessages(
  system: string,
  transcript: ApiMessage[]
): Promise<WireMessage[]> {
  const list = repairTranscript(transcript)
  let lastUser = -1
  list.forEach((m, i) => {
    if (m.role === 'user') lastUser = i
  })
  const out: WireMessage[] = [{ role: 'system', content: system }]
  for (const [i, m] of list.entries()) {
    if (m.role !== 'user') {
      out.push(m as WireMessage)
      continue
    }
    const ids = m.images ?? []
    if (i !== lastUser || !ids.length) {
      const note = ids.length
        ? `\n[${ids.length} picture(s) were attached here earlier; they are no longer shown.]`
        : ''
      out.push({ role: 'user', content: m.content + note })
      continue
    }
    const parts: ApiContentPart[] = [{ type: 'text', text: m.content }]
    for (const id of ids) {
      const url = await pictureUrl(id)
      if (url) parts.push({ type: 'image_url', image_url: { url } })
    }
    out.push({ role: 'user', content: parts })
  }
  return out
}
