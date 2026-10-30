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
import type { Ctx, Gesture, NodeRec } from './context'
import { elOf } from './dom'
import { local, measure, selKind } from './query'
import { createTouch } from './touch'
import type { Point } from './types'
import { CORNERS } from './ui'

/*
 * Pointer input on the canvas: what a press starts (pan, marquee, drag,
 * frame drag, resize, 圈选 stroke, touch tap), and the moves and release.
 */
export function createPointer(c: Ctx) {
  const d = c.d
  const touch = createTouch(c)

  function begin(g: Gesture) {
    c.G = g
    if (g.type === 'pan') d.el.classList.add('is-panning')
  }

  function nodeAt(t: Element): NodeRec | null {
    const ne = t.closest<HTMLElement>('.bd-cv-node')
    return ne ? (c.nodes.get(ne.dataset.cvId ?? '') ?? null) : null
  }

  /** A press on a frame title selects the frame and may drag it. */
  function pressTitle(title: HTMLElement, start: Point) {
    const g = c.groups.get(title.dataset.cvTitle ?? '')
    if (!g) return
    c.fx.setSel([g.id], true)
    d.world.classList.remove('bd-cv-flowing')
    const kids = g.children.flatMap((id): Array<[NodeRec, number, number]> => {
      const n = c.nodes.get(id)
      return n ? [[n, n.ax, n.ay]] : []
    })
    begin({ type: 'gdrag', g, start, ox: g.x, oy: g.y, moved: false, kids })
  }

  /** A press on a picture: shift toggles it, then it may be dragged. */
  function pressNode(e: PointerEvent, n: NodeRec, pt: Point) {
    let collapse: string | null = null
    if (e.shiftKey) {
      const cur = selKind(c) === 'group' ? new Set<string>() : new Set(c.sel)
      if (cur.has(n.id)) cur.delete(n.id)
      else cur.add(n.id)
      c.fx.setSel([...cur], true)
      if (!cur.has(n.id)) return
    } else if (!c.sel.has(n.id)) {
      c.fx.setSel([n.id], true)
    } else if (c.sel.size > 1) {
      collapse = n.id
    }
    c.fx.startDrag(n, pt, collapse)
  }

  function onDown(e: PointerEvent) {
    const t = elOf(e.target)
    if (!t || t.closest('.bd-cv-ui') || t.closest('.bd-cv-tb')) return
    if (c.renaming?.nm.contains(t)) return
    if (e.button === 2) return
    c.fx.closeMenu()
    if (c.renaming) c.fx.commitRename()
    measure(c)
    const pt = local(c, e)
    if (e.pointerType === 'touch' && touch.down(e.pointerId, pt)) return
    // The 重试 button on a failed picture gets a normal click.
    if (t.closest('.bd-cv-node button')) return
    if (document.activeElement !== d.el) d.el.focus({ preventScroll: true })
    c.fx.stopCam()
    try {
      d.el.setPointerCapture(e.pointerId)
    } catch {
      // The pointer may already be gone.
    }
    const panKey = c.tool === 'hand' || c.spaceDown
    if (e.button === 1 || (e.button === 0 && panKey)) {
      e.preventDefault()
      begin({ type: 'pan', last: pt })
      return
    }
    if (e.button !== 0) return
    const corner = CORNERS.find(
      (k) => k === t.closest<HTMLElement>('[data-cv-handle]')?.dataset.cvHandle
    )
    if (corner) {
      c.fx.startResize(corner)
      return
    }
    const title = t.closest<HTMLElement>('[data-cv-title]')
    if (title) {
      pressTitle(title, pt)
      return
    }
    const n = nodeAt(t)
    if (c.tool === 'mark' && n?.status === 'ready') {
      c.fx.startMark(n, pt)
      return
    }
    if (c.pick) {
      if (n && n.id !== c.pick && n.status === 'ready') {
        const a = c.pick
        c.fx.cancelPick()
        c.fx.compare(a, n.id)
      } else if (!n) {
        c.fx.cancelPick()
      }
      return
    }
    const grabSelected = !!n && c.sel.has(n.id) && c.tool === 'select'
    if (e.pointerType === 'touch' && !grabSelected) {
      begin({ type: 'tap', start: pt, last: pt, node: n, moved: false })
      return
    }
    if (c.tool === 'mark') {
      begin({ type: 'pan', last: pt })
      return
    }
    if (n) {
      pressNode(e, n, pt)
      return
    }
    if (!e.shiftKey) c.fx.setSel([], true)
    const keep = e.shiftKey && selKind(c) !== 'group'
    const base = keep ? new Set(c.sel) : new Set<string>()
    begin({ type: 'marquee', start: pt, base, moved: false })
  }

  function onMove(e: PointerEvent) {
    const pt = local(c, e)
    if (e.pointerType === 'touch' && touch.move(e.pointerId, pt)) return
    const G = c.G
    if (!G) {
      hoverCheck(e)
      return
    }
    switch (G.type) {
      case 'pan':
        c.fitTarget = null
        c.cam.x += pt.x - G.last.x
        c.cam.y += pt.y - G.last.y
        G.last = pt
        c.fx.moving()
        c.fx.invalidate()
        break
      case 'tap':
        if (!G.moved && Math.hypot(pt.x - G.start.x, pt.y - G.start.y) > 6) {
          G.moved = true
        }
        if (G.moved) {
          c.fitTarget = null
          c.cam.x += pt.x - G.last.x
          c.cam.y += pt.y - G.last.y
          c.fx.moving()
          c.fx.invalidate()
        }
        G.last = pt
        break
      case 'marquee':
        c.fx.marqueeMove(G, pt)
        break
      case 'drag':
        c.fx.dragMove(G, pt)
        break
      case 'gdrag': {
        if (!G.moved && Math.hypot(pt.x - G.start.x, pt.y - G.start.y) < 3) {
          break
        }
        G.moved = true
        const dx = (pt.x - G.start.x) / c.cam.s
        const dy = (pt.y - G.start.y) / c.cam.s
        G.g.x = G.ox + dx
        G.g.y = G.oy + dy
        c.fx.placeFrame(G.g)
        for (const [n, x, y] of G.kids) {
          n.ax = x + dx
          n.ay = y + dy
          c.fx.placeNode(n)
        }
        c.fx.invalidate()
        break
      }
      case 'resize':
        c.fx.resizeMove(G, pt)
        break
      case 'mark':
        c.fx.markMove(G, pt)
        break
      default:
        break
    }
  }

  function onUp(e: PointerEvent) {
    if (e.pointerType === 'touch' && touch.up(e.pointerId)) return
    const G = c.G
    if (!G) return
    switch (G.type) {
      case 'tap':
        if (!G.moved) tapped(G.node)
        break
      case 'marquee':
        d.mq.style.display = 'none'
        break
      case 'drag':
        c.fx.dragEnd(G)
        break
      case 'gdrag':
        if (G.moved) c.fx.changed()
        break
      case 'resize':
        c.fx.changed()
        break
      case 'mark':
        c.fx.markEnd(G)
        break
      default:
        break
    }
    c.G = null
    d.el.classList.remove('is-panning')
    c.fx.invalidate()
  }

  function tapped(n: NodeRec | null) {
    if (c.pick && n?.status === 'ready' && n.id !== c.pick) {
      const a = c.pick
      c.fx.cancelPick()
      c.fx.compare(a, n.id)
      return
    }
    c.fx.setSel(n ? [n.id] : [], true)
  }

  function hoverCheck(e: PointerEvent) {
    const t = elOf(e.target)
    const ne = t?.closest<HTMLElement>('.bd-cv-node') ?? null
    const te = ne ? null : (t?.closest<HTMLElement>('[data-cv-title]') ?? null)
    const id = ne?.dataset.cvId ?? null
    const gid = te?.dataset.cvTitle ?? null
    if (id === c.hoverId && gid === c.hoverG) return
    c.hoverId = id
    c.hoverG = gid
    c.fx.invalidate()
  }

  return {
    onDown,
    onMove,
    onUp,
    onWheel: touch.onWheel,
    onGestureStart: touch.onGestureStart,
    onGestureChange: touch.onGestureChange,
    onGestureEnd: touch.onGestureEnd,
  }
}
