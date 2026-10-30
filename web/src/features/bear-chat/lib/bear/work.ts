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
import type { Reply, UserTurn } from '../../types'
import { splitReply, splitThink } from '../artifacts'
import { workOf } from '../feel'
import type { BearAct } from './acts'

/** What the bear does while this reply is on its way. */
export function workAct(reply: Reply, user: UserTurn | undefined): BearAct {
  const hint = user ? workOf(user.text, user.images?.length ?? 0) : null
  const deep = reply.effort === 'high'
  const { text, thinking } = splitThink(reply.content)
  if (!text.trim()) {
    const reasoning = Boolean(reply.reasoning) || thinking
    if (!reasoning && (hint === 'read' || hint === 'book')) return hint
    return deep ? 'wand' : 'think'
  }
  const open = splitReply(text, reply.id).open
  if (open) return open.kind === 'html' || open.kind === 'svg' ? 'web' : 'code'
  if (hint === 'translate' || hint === 'calc') return hint
  return 'write'
}
