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
import type { NodeStatus } from '../../lib/canvas/types'
import { mountHalftone, type HalftoneHandle } from '../../lib/halftone'
import type { Project } from '../../types'

/*
 * The 「点阵显影」 dot screens of the canvas's waiting pictures, one per
 * node: mounted in the canvas's waiting slot, lifted when the picture comes
 * (the canvas's revealer), dropped when the picture fails or goes away.
 */

type Entry = { ht: HalftoneHandle; startedAt?: number }

/** An edit of a picture (edits take longer, so the words differ). */
function isEdit(p: Project, nodeId: string): boolean {
  for (const m of p.messages) {
    if (m.role !== 'agent') continue
    for (const part of m.parts) {
      if (part.type !== 'progress') continue
      const it = part.items.find((x) => x.nodeId === nodeId)
      if (it) return !!it.edit
    }
  }
  return false
}

export type Halftones = ReturnType<typeof createHalftones>

export function createHalftones(project: () => Project) {
  const map = new Map<string, Entry>()

  function drop(nodeId: string) {
    map.get(nodeId)?.ht.destroy()
    map.delete(nodeId)
  }

  /** The canvas asks for a waiting slot's content. */
  function mount(slot: HTMLElement, nodeId: string) {
    drop(nodeId)
    const p = project()
    const n = p.nodes.find((x) => x.id === nodeId)
    // A finished picture whose file is still loading: just the quiet card.
    if (n?.status !== 'pending') return
    const g = p.groups.find((x) => x.id === n.groupId)
    const startedAt = n.meta.startedAt
    const ht = mountHalftone(slot, {
      startedAt,
      model: n.meta.model,
      edit: isEdit(p, n.id),
      i: Math.max(0, g ? g.children.indexOf(n.id) : 0),
      queued: !startedAt,
    })
    map.set(nodeId, { ht, startedAt })
  }

  /** The picture came: it develops under the dot screen, then takes over. */
  function reveal(
    nodeId: string,
    img: HTMLImageElement,
    media: HTMLElement
  ): Promise<void> | null {
    const e = map.get(nodeId)
    map.delete(nodeId)
    if (!e) return null
    return e.ht.reveal(img).then(() => {
      media.append(img)
    })
  }

  /** After the canvas redrew a picture: no dot screen unless it waits. */
  function settle(nodeId: string, status: NodeStatus) {
    if (status !== 'pending') drop(nodeId)
  }

  /** Queued pictures that started drawing; pictures that went away. */
  function update(p: Project) {
    const ids = new Set(p.nodes.map((n) => n.id))
    for (const id of map.keys()) if (!ids.has(id)) drop(id)
    for (const n of p.nodes) {
      const e = map.get(n.id)
      if (!e || n.status !== 'pending') continue
      const started = n.meta.startedAt
      if (started && started !== e.startedAt) e.ht.setStarted(started)
      else if (!started && e.startedAt) e.ht.setQueued(true)
      e.startedAt = started
    }
  }

  function destroyAll() {
    for (const e of map.values()) e.ht.destroy()
    map.clear()
  }

  return { mount, reveal, settle, update, destroyAll }
}
