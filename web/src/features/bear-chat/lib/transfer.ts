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
  ChatImage,
  ChatTurn,
  Conversation,
  Reply,
  ReplyStatus,
} from '../types'
import { splitThink } from './artifacts'

/*
 * Moving conversations in and out of the browser: Markdown for reading,
 * JSON for importing again (here or in another browser).
 */

const FORMAT = 'xiaoxiong-chat'

export function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function fileSafe(name: string): string {
  return (
    name
      .replaceAll(/[\\/:*?"<>|\n]+/g, ' ')
      .trim()
      .slice(0, 60) || 'chat'
  )
}

export function toMarkdown(
  conv: Conversation,
  labels: { user: string; system: string; image: string }
): string {
  const out = [`# ${conv.title}`, '']
  if (conv.system?.trim()) {
    out.push(`> **${labels.system}**: ${conv.system.trim()}`, '')
  }
  for (const turn of conv.turns) {
    if (turn.role === 'user') {
      out.push(`**${labels.user}**`, '')
      if (turn.text.trim()) out.push(turn.text.trim())
      if (turn.images?.length) {
        out.push(`_(${labels.image} × ${turn.images.length})_`)
      }
      out.push('')
      continue
    }
    const reply = (turn as AssistantTurn).replies[turn.cur]
    if (!reply || !reply.content.trim()) continue
    out.push(
      `**${reply.model}**`,
      '',
      splitThink(reply.content).text.trim(),
      ''
    )
  }
  return out.join('\n')
}

export function toJson(convs: Conversation[]): string {
  return JSON.stringify(
    { format: FORMAT, version: 1, conversations: convs },
    null,
    2
  )
}

type Loose = Record<string, unknown>

const isObject = (value: unknown): value is Loose =>
  !!value && typeof value === 'object'

const text = (value: unknown) => (typeof value === 'string' ? value : '')
const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const STATUSES = new Set<ReplyStatus>(['done', 'stopped', 'error'])

function cleanImage(value: unknown): ChatImage | null {
  if (!isObject(value) || typeof value.id !== 'string') return null
  if (typeof value.url !== 'string' || !value.url.startsWith('data:image/')) {
    return null
  }
  return {
    id: value.id,
    url: value.url,
    ...(typeof value.name === 'string' ? { name: value.name } : {}),
    w: num(value.w, 0),
    h: num(value.h, 0),
  }
}

function cleanReply(value: unknown, now: number): Reply | null {
  if (!isObject(value) || typeof value.id !== 'string') return null
  const reply = { ...value } as Loose
  // A reply that was still streaming when it was exported ended there.
  const status = STATUSES.has(value.status as ReplyStatus)
    ? (value.status as ReplyStatus)
    : 'stopped'
  if (!isObject(value.error) || typeof value.error.message !== 'string') {
    delete reply.error
  }
  if (typeof value.reasoning !== 'string') delete reply.reasoning
  return {
    ...(reply as Partial<Reply>),
    id: value.id,
    model: text(value.model),
    content: text(value.content),
    status,
    startedAt: num(value.startedAt, now),
  }
}

function cleanTurn(value: unknown, now: number): ChatTurn | null {
  if (!isObject(value) || typeof value.id !== 'string') return null
  if (value.role === 'user') {
    if (typeof value.text !== 'string') return null
    const images = Array.isArray(value.images)
      ? value.images
          .map(cleanImage)
          .filter((img): img is ChatImage => img !== null)
      : []
    return {
      id: value.id,
      role: 'user',
      text: value.text,
      ...(images.length ? { images } : {}),
      at: num(value.at, now),
    }
  }
  if (value.role !== 'assistant' || !Array.isArray(value.replies)) return null
  const replies = value.replies
    .map((r) => cleanReply(r, now))
    .filter((r): r is Reply => r !== null)
  if (!replies.length) return null
  const cur = Math.trunc(num(value.cur, replies.length - 1))
  return {
    id: value.id,
    role: 'assistant',
    replies,
    cur: Math.min(Math.max(cur, 0), replies.length - 1),
  }
}

/**
 * One conversation from a file, with every field the page reads checked:
 * a hand-edited or foreign file must not break the page when it is opened.
 */
function cleanConversation(value: unknown, now: number): Conversation | null {
  if (!isObject(value) || typeof value.id !== 'string') return null
  if (typeof value.title !== 'string' || !Array.isArray(value.turns)) {
    return null
  }
  return {
    id: value.id,
    title: value.title,
    ...(value.named === true ? { named: true } : {}),
    createdAt: num(value.createdAt, now),
    updatedAt: num(value.updatedAt, now),
    ...(typeof value.system === 'string' ? { system: value.system } : {}),
    turns: value.turns
      .map((t) => cleanTurn(t, now))
      .filter((t): t is ChatTurn => t !== null),
  }
}

/** Conversations in an exported file; throws when it is not one of ours. */
export function fromJson(text: string): Conversation[] {
  const data: unknown = JSON.parse(text)
  const list =
    data && typeof data === 'object' && 'conversations' in data
      ? (data as { conversations: unknown }).conversations
      : data
  if (!Array.isArray(list)) throw new Error('not a chat export')
  const now = Date.now()
  const convs = list
    .map((c) => cleanConversation(c, now))
    .filter((c): c is Conversation => c !== null)
  if (!convs.length) throw new Error('no conversations')
  return convs
}

/**
 * What an import adds: conversations this account already has are skipped,
 * the rest get new ids. Saved chats are keyed by id alone, across every
 * account on this browser, so keeping the file's id would move another
 * account's copy of that chat into this one.
 */
export function importable(
  list: Conversation[],
  known: ReadonlySet<string>,
  makeId: () => string
): Conversation[] {
  return list
    .filter((c) => !known.has(c.id))
    .map((c) => ({ ...c, id: makeId() }))
}
