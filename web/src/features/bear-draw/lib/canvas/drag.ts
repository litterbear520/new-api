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
  Corner,
  Ctx,
  DragGesture,
  GroupRec,
  MarqueeGesture,
  NodeRec,
  ResizeGesture,
} from './context'
import { place } from './dom'
import { clamp, flow } from './geometry'
import { selNode, toWorld } from './query'
import type { Point } from './types'

/*
 * Marquee selection, dragging pictures (frames re-flow to make room; a drop
 * on a frame joins it, a drop outside leaves a free picture) and resizing
 * from the corners with the aspect ratio locked.
 */
export function createDrag(c: Ctx) {
  const d = c.d

  function marqueeMove(G: MarqueeGesture, pt: Point) {
    if (!G.moved && Math.hypot(pt.x - G.start.x, pt.y - G.start.y) < 3) return
    G.moved = true
    const r = {
      x: Math.min(pt.x, G.start.x),
      y: Math.min(pt.y, G.start.y),
      w: Math.abs(pt.x - G.start.x),
      h: Math.abs(pt.y - G.start.y),
    }
    d.mq.style.display = ''
    place(d.mq, r)
    const a = toWorld(c, r)
    const b = toWorld(c, { x: r.x + r.w, y: r.y + r.h })
    const hits = new Set(G.base)
    for (const n of c.nodes.values()) {
      const inX = n.ax < b.x && n.ax + n.dw > a.x
      if (inX && n.ay < b.y && n.ay + n.dh > a.y) hits.add(n.id)
    }
    c.fx.setSel([...hits], true)
  }

  /** Reading order: frames first (in their order), then free pictures. */
  function order(id: string): number {
    const n = c.nodes.get(id)
    if (!n) return 0
    if (!n.groupId) return 1e6 + n.ax
    const g = c.groups.get(n.groupId)
    return c.gOrder.indexOf(n.groupId) * 1e4 + (g ? g.children.indexOf(id) : 0)
  }

  function startDrag(n: NodeRec, pt: Point, collapse: string | null) {
    const ids = [...c.sel].filter((id) => c.nodes.has(id))
    ids.sort((a, b) => order(a) - order(b))
    const orig = new Map<string, Point>()
    const touched = new Set<string>()
    for (const id of ids) {
      const m = c.nodes.get(id)
      if (!m) continue
      orig.set(id, { x: m.ax, y: m.ay })
      if (m.groupId) touched.add(m.groupId)
    }
    c.G = {
      type: 'drag',
      start: pt,
      ids,
      set: new Set(ids),
      primary: n.id,
      orig,
      started: false,
      collapse,
      target: null,
      index: -1,
      touched,
    }
  }

  /** The frame under p; the current target keeps a 28-unit margin. */
  function groupAt(p: Point, cur: GroupRec | null): GroupRec | null {
    for (let i = c.gOrder.length - 1; i >= 0; i--) {
      const g = c.groups.get(c.gOrder[i])
      if (!g) continue
      const m = g === cur ? 28 : 0
      const inX = p.x >= g.x - m && p.x <= g.x + g.w + m
      if (inX && p.y >= g.y - m && p.y <= g.y + g.h + m) return g
    }
    return null
  }

  const sizeOf = (id: string) => {
    const n = c.nodes.get(id)
    return n ? { w: n.dw, h: n.dh } : { w: 0, h: 0 }
  }

  /** The insert position whose slot is closest to the dragged picture. */
  function bestIndex(G: DragGesture, g: GroupRec): number {
    const base = g.children.filter((id) => !G.set.has(id))
    const pn = c.nodes.get(G.primary)
    if (!pn) return base.length
    const k0 = G.ids.indexOf(G.primary)
    const cx = pn.ax + pn.dw / 2
    const cy = pn.ay + pn.dh / 2
    let best = base.length
    let bd = Infinity
    for (let i = 0; i <= base.length; i++) {
      const ids = [...base]
      ids.splice(i, 0, ...G.ids)
      const p = flow(ids.map(sizeOf)).pos[i + k0]
      const dist = Math.hypot(
        g.x + p.x + pn.dw / 2 - cx,
        g.y + p.y + pn.dh / 2 - cy
      )
      if (dist < bd - 0.5) {
        bd = dist
        best = i
      }
    }
    return best
  }

  function dragMove(G: DragGesture, pt: Point) {
    if (!G.started) {
      if (Math.hypot(pt.x - G.start.x, pt.y - G.start.y) < 3) return
      G.started = true
      for (const id of G.ids) c.nodes.get(id)?.el.classList.add('is-drag')
      c.hoverId = null
    }
    const dx = (pt.x - G.start.x) / c.cam.s
    const dy = (pt.y - G.start.y) / c.cam.s
    for (const id of G.ids) {
      const n = c.nodes.get(id)
      const p0 = G.orig.get(id)
      if (!n || !p0) continue
      n.ax = p0.x + dx
      n.ay = p0.y + dy
      c.fx.placeNode(n)
    }
    const tgt = groupAt(toWorld(c, pt), G.target)
    const idx = tgt ? bestIndex(G, tgt) : -1
    if (tgt !== G.target || idx !== G.index) {
      G.target = tgt
      G.index = idx
      if (tgt) G.touched.add(tgt.id)
      c.fx.flowing()
      for (const gid of G.touched) {
        const g = c.groups.get(gid)
        if (!g) continue
        const insert = tgt === g ? { index: idx, ids: G.ids } : null
        c.fx.layoutGroup(g, { exclude: G.set, skip: G.set, insert })
      }
      if (!tgt) {
        for (const id of G.ids) {
          const n = c.nodes.get(id)
          if (n) n.slot = null
        }
      }
    }
    c.fx.invalidate()
  }

  function dragEnd(G: DragGesture) {
    if (!G.started) {
      if (G.collapse) c.fx.setSel([G.collapse], true)
      return
    }
    const live = G.ids.filter((id) => c.nodes.has(id))
    for (const id of live) {
      const n = c.nodes.get(id)
      const og = n?.groupId ? c.groups.get(n.groupId) : undefined
      if (og) og.children = og.children.filter((x) => x !== id)
      if (n) n.groupId = null
    }
    const target = G.target && c.groups.has(G.target.id) ? G.target : null
    if (target) {
      const at = clamp(G.index, 0, target.children.length)
      target.children.splice(at, 0, ...live)
      for (const id of live) {
        const n = c.nodes.get(id)
        if (n) n.groupId = target.id
      }
    }
    c.fx.flowing()
    for (const id of live) {
      const n = c.nodes.get(id)
      if (!n) continue
      n.el.classList.remove('is-drag')
      n.slot = null
      if (!n.groupId) c.fx.placeNode(n)
    }
    for (const gid of G.touched) {
      const g = c.groups.get(gid)
      if (g) c.fx.layoutGroup(g)
    }
    if (target) c.fx.settle()
    c.tbKey = ''
    c.fx.changed()
  }

  function startResize(corner: Corner) {
    const n = selNode(c)
    if (!n) return
    d.world.classList.remove('bd-cv-flowing')
    const ax = corner[1] === 'w' ? n.ax + n.dw : n.ax
    const ay = corner[0] === 'n' ? n.ay + n.dh : n.ay
    c.G = { type: 'resize', n, corner, ax, ay, ratio: n.dw / n.dh }
  }

  function resizeMove(G: ResizeGesture, pt: Point) {
    const n = G.n
    const p = toWorld(c, pt)
    const dx = Math.abs(p.x - G.ax)
    const dy = Math.abs(p.y - G.ay)
    const nw = clamp(Math.max(dx, dy * G.ratio), 48, 40000)
    n.dw = nw
    n.dh = nw / G.ratio
    n.userSized = true
    const g = n.groupId ? c.groups.get(n.groupId) : undefined
    if (g) {
      c.fx.layoutGroup(g)
    } else {
      n.ax = G.corner[1] === 'w' ? G.ax - n.dw : G.ax
      n.ay = G.corner[0] === 'n' ? G.ay - n.dh : G.ay
      c.fx.placeNode(n)
    }
    c.fx.invalidate()
  }

  return {
    marqueeMove,
    startDrag,
    dragMove,
    dragEnd,
    startResize,
    resizeMove,
  }
}
