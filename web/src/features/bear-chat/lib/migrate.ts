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
import {
  loadConfig,
  loadMessages,
} from '@/features/playground/lib/storage/storage'
import type { Message } from '@/features/playground/types'

import type { ChatTurn, Conversation, Reply } from '../types'
import { newId, titleFrom } from './run'

/*
 * The old playground kept one conversation in localStorage. The first time
 * the new page opens in a browser it is copied over as a conversation, so
 * nothing the user had disappears. The old data stays where it was.
 */

const FLAG = 'bear-chat.migrated'

function convert(messages: Message[], model: string): ChatTurn[] {
  const turns: ChatTurn[] = []
  for (const m of messages) {
    const text = m.versions[0]?.content ?? ''
    const at = m.createdAt ?? Date.now()
    if (m.from === 'user') {
      turns.push({ id: newId('u'), role: 'user', text, at })
    } else if (m.from === 'assistant') {
      const reply: Reply = {
        id: newId('r'),
        model,
        content: text,
        reasoning: m.reasoning?.content || undefined,
        status: m.status === 'error' ? 'error' : 'done',
        startedAt: m.startedAt ?? at,
        endedAt: m.completedAt ?? at,
        error: m.status === 'error' ? { message: text || 'Error' } : undefined,
      }
      turns.push({
        id: newId('a'),
        role: 'assistant',
        replies: [reply],
        cur: 0,
      })
    }
  }
  return turns
}

/** The old playground's conversation, once per browser. */
export function takeOldPlayground(): Conversation | null {
  try {
    if (localStorage.getItem(FLAG)) return null
    localStorage.setItem(FLAG, '1')
  } catch {
    return null
  }
  const messages = loadMessages()
  if (!messages?.length) return null
  const turns = convert(messages, loadConfig().model ?? '')
  const first = turns.find((t) => t.role === 'user')
  if (!first || first.role !== 'user') return null
  const at = first.at
  return {
    id: newId('c'),
    title: titleFrom(first.text) || '…',
    createdAt: at,
    updatedAt: turns.length ? Date.now() - 1 : at,
    turns,
  }
}
