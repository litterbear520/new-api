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
import type { AssistantTurn, Conversation } from '../types'
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

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<Conversation>
  return (
    typeof c.id === 'string' &&
    typeof c.title === 'string' &&
    Array.isArray(c.turns) &&
    c.turns.every(
      (t) =>
        t &&
        typeof t === 'object' &&
        typeof t.id === 'string' &&
        (t.role === 'user'
          ? typeof t.text === 'string'
          : t.role === 'assistant' && Array.isArray(t.replies))
    )
  )
}

/** Conversations in an exported file; throws when it is not one of ours. */
export function fromJson(text: string): Conversation[] {
  const data: unknown = JSON.parse(text)
  const list =
    data && typeof data === 'object' && 'conversations' in data
      ? (data as { conversations: unknown }).conversations
      : data
  if (!Array.isArray(list)) throw new Error('not a chat export')
  const convs = list.filter(isConversation)
  if (!convs.length) throw new Error('no conversations')
  const now = Date.now()
  return convs.map((c) => ({
    ...c,
    createdAt: typeof c.createdAt === 'number' ? c.createdAt : now,
    updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : now,
  }))
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
