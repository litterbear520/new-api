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
import type { Ctx, NodeRec } from './context'
import { now, place, translate } from './dom'
import { union } from './geometry'
import { firstOf, gRect, nRect, selKind, selNode } from './query'
import { placeToolbar } from './toolbar'
import type { Rect } from './types'

/* Selection outlines, resize handles, the size label and the toolbar. */

function sizeText(c: Ctx, n: NodeRec, live: boolean): string {
  const size = `${n.w} × ${n.h}`
  if (live) return `${size} · ${Math.round((n.dw / n.w) * 100)}%`
  if (n.status === 'pending') return c.L.drawingSize(size)
  if (n.status === 'failed') return c.L.failedSize(size)
  return size
}

/** Zoomed far out the label can land on the next frame's title. */
function labelHitsTitle(c: Ctx, bb: Rect): boolean {
  const ly = bb.y + bb.h + 8
  const cx = bb.x + bb.w / 2
  for (const g of c.groups.values()) {
    const r = gRect(c, g)
    const below = ly < r.y && ly + 18 > r.y - 30
    if (below && cx + 50 > r.x && cx - 50 < r.x + r.w) return true
  }
  return false
}

export function renderSelection(c: Ctx) {
  const d = c.d
  d.boxPool.begin()
  const kind = selKind(c)
  const settling = now() < c.settleUntil
  d.selL.classList.toggle('is-settling', settling)
  let bb: Rect | null = null
  let label = ''
  let showHandles = false
  if (kind === 'group') {
    const g = c.groups.get(firstOf(c.sel) ?? '')
    if (g) {
      bb = gRect(c, g)
      const b = d.boxPool.next()
      b.className = 'bd-cv-sel is-group'
      place(b, bb)
      label = c.L.setCount(g.children.length)
    }
  } else if (kind) {
    for (const id of c.sel) {
      const n = c.nodes.get(id)
      if (!n) continue
      const r = nRect(c, n)
      const b = d.boxPool.next()
      b.className = 'bd-cv-sel'
      place(b, r)
      bb = union(bb, r)
    }
    const n = kind === 'image' ? selNode(c) : null
    if (n) {
      label = sizeText(c, n, c.G?.type === 'resize')
      const dragging = c.G?.type === 'drag' && c.G.started
      showHandles = c.tool === 'select' && !dragging
    } else if (kind === 'multi') {
      label = c.L.selectedCount(c.sel.size)
    }
  }
  d.boxPool.end()

  if (kind === 'multi' && bb) {
    d.unionBox.style.display = ''
    place(d.unionBox, {
      x: bb.x - 6,
      y: bb.y - 6,
      w: bb.w + 12,
      h: bb.h + 12,
    })
  } else {
    d.unionBox.style.display = 'none'
  }

  for (const hd of d.handles) {
    const corner = hd.dataset.cvHandle ?? ''
    if (!showHandles || !bb) {
      hd.style.display = 'none'
      continue
    }
    hd.style.display = ''
    const x = corner[1] === 'w' ? bb.x : bb.x + bb.w
    const y = corner[0] === 'n' ? bb.y : bb.y + bb.h
    hd.style.transform = translate(x, y)
  }

  const markMode = c.tool === 'mark' && kind === 'image'
  if (bb && label && !markMode && !labelHitsTitle(c, bb)) {
    d.sizeL.style.display = ''
    if (d.sizeL.textContent !== label) d.sizeL.textContent = label
    d.sizeL.style.transform = `${translate(bb.x + bb.w / 2, bb.y + bb.h + 8)} translateX(-50%)`
  } else {
    d.sizeL.style.display = 'none'
  }
  placeToolbar(c, kind, bb, settling)
}
