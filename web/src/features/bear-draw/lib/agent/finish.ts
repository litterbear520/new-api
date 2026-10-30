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
import { newId } from '@/stores/bear-draw-store'

import type { AgentMessage, AgentStatus, Part } from '../../types'
import { editMessage } from '../project-edit'

/*
 * Closing an agent message: stop the shimmer on live lines and add (or
 * refresh) the result line that counts the pictures of this turn.
 */

type ResultPart = Extract<Part, { type: 'result' }>

/** The result line for a message's pictures, or null when it drew nothing. */
export function resultFor(m: AgentMessage): Omit<ResultPart, 'id'> | null {
  let done = 0
  let failed = 0
  let stopped = 0
  let groupId: string | undefined
  for (const part of m.parts) {
    if (part.type !== 'progress') continue
    groupId = part.groupId
    for (const it of part.items) {
      if (it.status === 'done') done++
      else if (it.status === 'failed' || it.status === 'lost') failed++
      else if (it.status === 'stopped') stopped++
    }
  }
  if (!done && !failed && !stopped) return null
  // Time spent drawing, not time spent waiting for the user to confirm;
  // pictures that finished after ■ count until they arrived.
  const items = m.parts.flatMap((part) =>
    part.type === 'progress' ? part.items : []
  )
  const starts = items.flatMap((it) => (it.startedAt ? [it.startedAt] : []))
  const ends = items.flatMap((it) =>
    it.startedAt && it.secs ? [it.startedAt + it.secs * 1000] : []
  )
  const from = starts.length ? Math.min(...starts) : m.startedAt
  const end = Math.max(m.endedAt ?? Date.now(), ...ends)
  return {
    type: 'result',
    done,
    failed,
    stopped,
    cost: m.cost,
    secs: Math.max(1, Math.round((end - from) / 1000)),
    groupId,
    suggestions: m.suggestions ?? [],
    compact: m.mode === 'image',
  }
}

function settle(part: Part): Part {
  if (part.type === 'status' && part.live) return { ...part, live: false }
  if (part.type === 'text' && part.streaming) {
    return { ...part, streaming: false }
  }
  return part
}

/** Marks a message finished and puts its result line last. */
export function finishTurn(
  projectId: string,
  messageId: string,
  status: AgentStatus
) {
  editMessage(projectId, messageId, (m) => {
    const ended = { ...m, status, endedAt: Date.now() }
    const parts = m.parts.filter((x) => x.type !== 'result').map(settle)
    const result = resultFor({ ...ended, parts })
    return {
      ...ended,
      parts: result ? [...parts, { ...result, id: newId('pt') }] : parts,
    }
  })
}

/**
 * Recounts the result line of a finished message (a retried picture, or
 * pictures that arrived after ■), adding it when it is missing.
 */
export function refreshResult(projectId: string, messageId: string) {
  editMessage(projectId, messageId, (m) => {
    if (m.status === 'running' || m.status === 'waiting') return m
    const result = resultFor(m)
    if (!result) return m
    if (!m.parts.some((x) => x.type === 'result')) {
      return { ...m, parts: [...m.parts, { ...result, id: newId('pt') }] }
    }
    return {
      ...m,
      parts: m.parts.map((x) =>
        x.type === 'result' ? { ...result, id: x.id } : x
      ),
    }
  })
}
