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
  CanvasGroup,
  CanvasNode,
  ProgressItem,
  Project,
} from '../../types'

/*
 * 撤销 after a delete on the canvas: the deleted pictures (and the frame,
 * when a whole set went) go back where they were. Only what that delete
 * took is put back, so later edits, and other deletes undone or not, stay.
 */

export type Deleted = {
  nodes: { node: CanvasNode; index: number }[]
  /** Frames as they were, with where each sat in the list. */
  groups: { group: CanvasGroup; index: number }[]
  /** The frame deleted as a whole, if any. */
  frame: string | null
}

/** What deleting the pictures `ids` (and the frame `frame`) takes away. */
export function deletedFrom(
  p: Project,
  ids: Iterable<string>,
  frame: string | null = null
): Deleted {
  const gone = new Set(ids)
  return {
    nodes: p.nodes.flatMap((node, index) =>
      gone.has(node.id) ? [{ node, index }] : []
    ),
    groups: p.groups.flatMap((group, index) =>
      group.id === frame || group.children.some((id) => gone.has(id))
        ? [{ group, index }]
        : []
    ),
    frame,
  }
}

function progressFor(p: Project, nodeId: string): ProgressItem | null {
  for (const m of p.messages) {
    if (m.role === 'user') continue
    for (const part of m.parts) {
      if (part.type !== 'progress') continue
      const item = part.items.find((it) => it.nodeId === nodeId)
      if (item) return item
    }
  }
  return null
}

/**
 * A picture still drawing when it was deleted may have finished, failed or
 * stopped since; the drawing could not update a node that was gone, so it
 * comes back as its progress item in the chat ended. One still drawing
 * stays pending and is updated when it finishes.
 */
function caughtUp(p: Project, node: CanvasNode): CanvasNode {
  if (node.status !== 'pending') return node
  const item = progressFor(p, node.id)
  const meta = { ...node.meta, startedAt: undefined }
  switch (item?.status) {
    case 'done':
      if (!item.img) return node
      return {
        ...node,
        status: 'ready',
        img: item.img,
        w: item.img.w,
        h: item.img.h,
        meta: { ...meta, cost: item.cost, secs: item.secs, model: item.model },
      }
    case 'failed':
      return { ...node, status: 'failed', meta }
    case 'stopped':
    case 'lost':
      return { ...node, status: 'stopped', meta }
    default:
      return node
  }
}

/** Puts `item` back at `index`, or at the end when the list got shorter. */
function insertAt<T>(list: T[], index: number, item: T) {
  list.splice(Math.min(index, list.length), 0, item)
}

/** "5 · 淘宝" counts the pictures in the frame. */
const counted = (g: CanvasGroup, children: string[]): CanvasGroup => ({
  ...g,
  children,
  subtitle: g.subtitle?.replace(/\d+/, String(children.length)),
})

export function restoreDeleted(p: Project, del: Deleted): Project {
  const have = new Set(p.nodes.map((n) => n.id))
  const back = del.nodes.filter(({ node }) => !have.has(node.id))
  const frameGone = !!del.frame && !p.groups.some((g) => g.id === del.frame)
  if (!back.length && !frameGone) return p
  const backIds = new Set(back.map(({ node }) => node.id))
  const nodes = [...p.nodes]
  for (const { node, index } of back) {
    insertAt(nodes, index, caughtUp(p, node))
  }

  const groups = [...p.groups]
  for (const { group: was, index } of del.groups) {
    const at = groups.findIndex((g) => g.id === was.id)
    if (at < 0) {
      // The whole frame went: it comes back with the pictures it had.
      const kept = was.children.filter((id) => backIds.has(id))
      if (kept.length || was.id === del.frame) {
        insertAt(groups, index, counted(was, kept))
      }
      continue
    }
    const cur = groups[at]
    const children = [...cur.children]
    was.children.forEach((id, k) => {
      if (backIds.has(id) && !children.includes(id)) insertAt(children, k, id)
    })
    groups[at] = counted(cur, children)
  }
  return { ...p, nodes, groups }
}
