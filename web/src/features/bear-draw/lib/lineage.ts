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
import type { Attachment, Project } from '../types'

/*
 * Which picture an edited picture came from (meta.parentId), for 对比原图.
 * Projects from before 11-26 have no such record and get no button.
 */

/**
 * The canvas picture an image-mode message edits: the circled one, else the
 * only canvas picture attached.
 */
export function editedNode(refs: Attachment[]): string | undefined {
  const marked = refs.find((r) => r.marked && r.nodeId)
  if (marked) return marked.nodeId
  const cited = refs.filter((r) => r.nodeId)
  return cited.length === 1 ? cited[0].nodeId : undefined
}

/**
 * The one finished picture of a set that was edited from a picture still on
 * the canvas, with that picture. A set with several edits has no single
 * pair, so the result card offers none.
 */
export function editedPair(
  p: Project | null,
  groupId: string
): { from: string; to: string } | null {
  if (!p) return null
  const has = (id: string | undefined) =>
    Boolean(id && p.nodes.some((n) => n.id === id && n.status === 'ready'))
  // The pictures this set drew, wherever they were dragged since.
  const drawn = new Set(
    p.messages.flatMap((m) =>
      m.role === 'agent'
        ? m.parts.flatMap((x) =>
            x.type === 'progress' && x.groupId === groupId
              ? x.items.map((it) => it.nodeId)
              : []
          )
        : []
    )
  )
  const edits = p.nodes.filter(
    (n) => drawn.has(n.id) && n.status === 'ready' && has(n.meta.parentId)
  )
  if (edits.length !== 1) return null
  return { from: edits[0].meta.parentId as string, to: edits[0].id }
}
