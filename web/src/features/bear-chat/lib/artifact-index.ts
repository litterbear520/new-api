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
import type { Artifact, Conversation, Reply } from '../types'
import { splitReply, splitThink } from './artifacts'

/*
 * Artifacts of every shown reply in a conversation, in order. Replies are
 * immutable, so each one is split once and cached; only the streaming reply
 * is split again as it grows.
 */

const cache = new WeakMap<Reply, Artifact[]>()

export function artifactsOf(reply: Reply): Artifact[] {
  let list = cache.get(reply)
  if (!list) {
    list = splitReply(splitThink(reply.content).text, reply.id).artifacts
    cache.set(reply, list)
  }
  return list
}

export function conversationArtifacts(conv: Conversation | null): Artifact[] {
  if (!conv) return []
  const out: Artifact[] = []
  for (const turn of conv.turns) {
    if (turn.role !== 'assistant') continue
    const reply = turn.replies[turn.cur]
    if (reply) out.push(...artifactsOf(reply))
  }
  return out
}
