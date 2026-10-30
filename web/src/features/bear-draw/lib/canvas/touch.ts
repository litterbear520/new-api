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
import type { Ctx, PinchGesture } from './context'
import { elOf } from './dom'
import { clamp, MAX_S, MIN_S } from './geometry'
import { local, measure, toWorld } from './query'
import type { Point } from './types'

/*
 * Zoom and pan without a mouse: two-finger pinch, the wheel and trackpad
 * (a trackpad pinch arrives as ctrl+wheel), Safari's gesture events.
 */

/** A numeric field of an event TypeScript doesn't know (GestureEvent). */
function field(e: Event, key: string): number | null {
  const v: unknown = Reflect.get(e, key)
  return typeof v === 'number' ? v : null
}

export function createTouch(c: Ctx) {
  const d = c.d

  function pair(): [Point, Point] | null {
    const [a, b] = [...c.touches.values()]
    return a && b ? [a, b] : null
  }

  function startPinch() {
    const p = pair()
    if (!p) return
    const [a, b] = p
    const G = c.G
    if (G?.type === 'mark') {
      G.path.remove()
      G.halo.remove()
    }
    if (G?.type === 'drag' && G.started) c.fx.dragEnd(G)
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    c.G = {
      type: 'pinch',
      d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)),
      s0: c.cam.s,
      wm: toWorld(c, m),
    }
    d.el.classList.remove('is-panning')
  }

  function pinchMove(G: PinchGesture) {
    const p = pair()
    if (!p) return
    const [a, b] = p
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const dist = Math.hypot(a.x - b.x, a.y - b.y)
    const s = clamp((G.s0 * dist) / G.d0, MIN_S, MAX_S)
    c.fitTarget = null
    c.cam.s = s
    c.cam.x = m.x - G.wm.x * s
    c.cam.y = m.y - G.wm.y * s
    c.fx.moving()
    c.fx.invalidate()
  }

  /** A finger went down; true when it starts (or is part of) a pinch. */
  function down(id: number, pt: Point): boolean {
    c.touches.set(id, pt)
    if (c.touches.size === 2) {
      startPinch()
      return true
    }
    return c.touches.size > 2
  }

  /** True when the move was a pinch. */
  function move(id: number, pt: Point): boolean {
    if (!c.touches.has(id)) return false
    c.touches.set(id, pt)
    if (c.G?.type !== 'pinch') return false
    pinchMove(c.G)
    return true
  }

  /** True when the finger was part of a pinch. */
  function up(id: number): boolean {
    c.touches.delete(id)
    if (c.G?.type !== 'pinch') return false
    if (c.touches.size < 2) {
      c.G = null
      c.fx.changed()
    }
    return true
  }

  function onWheel(e: WheelEvent) {
    if (c.cmp) {
      e.preventDefault()
      return
    }
    const zoomKey = e.ctrlKey || e.metaKey
    if (!zoomKey && elOf(e.target)?.closest('.bd-cv-scroll')) return
    e.preventDefault()
    c.fx.closeMenu()
    c.fx.stopCam()
    measure(c)
    let dx = e.deltaX
    let dy = e.deltaY
    if (e.deltaMode === 1) {
      dx *= 16
      dy *= 16
    } else if (e.deltaMode === 2) {
      dx *= c.W
      dy *= c.H
    }
    if (zoomKey) {
      // A trackpad pinch sends small deltas; a mouse notch is about 100.
      const k = Math.abs(dy) >= 40 ? 0.0022 : 0.011
      const f = clamp(Math.exp(-dy * k), 0.5, 2)
      const p = local(c, e)
      c.fx.zoomAt(p.x, p.y, c.cam.s * f)
      return
    }
    if (e.shiftKey && !dx) {
      dx = dy
      dy = 0
    }
    c.fitTarget = null
    c.cam.x -= dx
    c.cam.y -= dy
    c.fx.moving()
    c.fx.invalidate()
  }

  function onGestureStart(e: Event) {
    if (c.touches.size) return
    e.preventDefault()
    c.fx.stopCam()
    measure(c)
    c.gesture.s = c.cam.s
    const x = field(e, 'clientX')
    const y = field(e, 'clientY')
    c.gesture.p =
      x != null && y != null ? local(c, { clientX: x, clientY: y }) : null
  }

  function onGestureChange(e: Event) {
    const p = c.gesture.p
    if (c.touches.size || !p) return
    e.preventDefault()
    c.fx.zoomAt(p.x, p.y, c.gesture.s * (field(e, 'scale') ?? 1))
  }

  function onGestureEnd(e: Event) {
    if (c.touches.size) return
    e.preventDefault()
    c.gesture.p = null
  }

  return {
    down,
    move,
    up,
    onWheel,
    onGestureStart,
    onGestureChange,
    onGestureEnd,
  }
}
