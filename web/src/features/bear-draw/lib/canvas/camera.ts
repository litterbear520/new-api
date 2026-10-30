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
import type { Ctx } from './context'
import { now, reduced } from './dom'
import {
  clamp,
  easeInOut,
  fitCamera,
  MAX_S,
  MIN_S,
  zoomStepDown,
  zoomStepUp,
} from './geometry'
import { boundsOf, contentBounds } from './query'
import type { Camera, FocusOptions } from './types'

/* Pan, zoom and the animated camera (zoom eases on a log scale). */

export function createCamera(c: Ctx) {
  function stopCam() {
    if (!c.camAnim) return
    cancelAnimationFrame(c.camAnim)
    c.camAnim = 0
  }

  function jump(to: Camera) {
    stopCam()
    c.cam.x = to.x
    c.cam.y = to.y
    c.cam.s = clamp(to.s, MIN_S, MAX_S)
    c.fx.moving()
    c.fx.invalidate()
  }

  /** Zooms keeping the world point under (px, py) in place. */
  function zoomAt(px: number, py: number, scale: number) {
    c.fitTarget = null
    const s = clamp(scale, MIN_S, MAX_S)
    const wx = (px - c.cam.x) / c.cam.s
    const wy = (py - c.cam.y) / c.cam.s
    c.cam.s = s
    c.cam.x = px - wx * s
    c.cam.y = py - wy * s
    c.fx.moving()
    c.fx.invalidate()
  }

  function animateCam(target: Camera, duration?: number) {
    stopCam()
    const to = { ...target, s: clamp(target.s, MIN_S, MAX_S) }
    if (reduced() || !c.W || duration === 0) {
      jump(to)
      return
    }
    const dur = duration || 560
    const from = { ...c.cam }
    const t0 = now()
    // Centre points in world units; the zoom moves on a log scale.
    const fc = {
      x: (c.W / 2 - from.x) / from.s,
      y: (c.H / 2 - from.y) / from.s,
    }
    const tc = { x: (c.W / 2 - to.x) / to.s, y: (c.H / 2 - to.y) / to.s }
    const l0 = Math.log(from.s)
    const l1 = Math.log(to.s)
    const step = () => {
      const k = Math.min(1, (now() - t0) / dur)
      const e = easeInOut(k)
      const s = Math.exp(l0 + (l1 - l0) * e)
      c.cam.s = s
      c.cam.x = c.W / 2 - (fc.x + (tc.x - fc.x) * e) * s
      c.cam.y = c.H / 2 - (fc.y + (tc.y - fc.y) * e) * s
      c.fx.moving()
      if (c.raf) {
        cancelAnimationFrame(c.raf)
        c.raf = 0
      }
      c.fx.frame()
      c.camAnim = k < 1 ? requestAnimationFrame(step) : 0
    }
    c.camAnim = requestAnimationFrame(step)
  }

  /** Frames the given ids, or everything for 'all' / null. */
  function focus(target: string[] | string | null, opt: FocusOptions = {}) {
    const all = target == null || target === 'all'
    const ids = (Array.isArray(target) ? target : [String(target)]).map(String)
    c.fitTarget = all ? 'all' : ids
    const r = all ? contentBounds(c) : boundsOf(c, ids)
    if (!r || !c.W) return
    const to = fitCamera(r, c.W, c.H, opt.maxScale)
    if (opt.animate === false) jump(to)
    else animateCam(to, opt.duration)
  }

  /** Follows new frames for a moment (see c.follow). */
  function scheduleFocus() {
    window.clearTimeout(c.timers.focus)
    c.timers.focus = window.setTimeout(() => {
      if (c.follow && !c.G && c.alive) focus(c.follow.ids, { animate: true })
    }, 70)
  }

  /**
   * Pictures landed or changed size: while the camera still frames what it
   * was asked to (nobody panned or zoomed since), frame it again.
   */
  function keepFraming() {
    if (!c.fitTarget || c.restoring) return
    // Following a new frame wins; it frames that one instead.
    if (c.follow && c.follow.until > now()) {
      scheduleFocus()
      return
    }
    window.clearTimeout(c.timers.focus)
    c.timers.focus = window.setTimeout(() => {
      if (c.fitTarget && !c.G && c.alive) focus(c.fitTarget, { animate: true })
    }, 120)
  }

  function zoomTo(scale: number, opt?: { animate?: boolean }) {
    c.fitTarget = null
    const s = clamp(Number(scale) || 1, MIN_S, MAX_S)
    const wx = (c.W / 2 - c.cam.x) / c.cam.s
    const wy = (c.H / 2 - c.cam.y) / c.cam.s
    const to = { s, x: c.W / 2 - wx * s, y: c.H / 2 - wy * s }
    if (opt?.animate === false) jump(to)
    else animateCam(to, 260)
  }

  const zoomIn = () => zoomTo(zoomStepUp(c.cam.s))
  const zoomOut = () => zoomTo(zoomStepDown(c.cam.s))
  const fit = () => {
    c.follow = null
    window.clearTimeout(c.timers.focus)
    focus('all')
  }

  return {
    stopCam,
    zoomAt,
    animateCam,
    focus,
    scheduleFocus,
    keepFraming,
    zoomTo,
    zoomIn,
    zoomOut,
    fit,
  }
}
