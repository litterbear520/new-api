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
import { union } from './geometry'
import { contentBounds, viewWorld } from './query'
import type { Rect } from './types'

/* The minimap: frames, pictures and the view; click or drag to move. */

function roundRect(x: CanvasRenderingContext2D, r: Rect, radius: number) {
  x.beginPath()
  // Older Safari has no roundRect.
  if (typeof x.roundRect === 'function') {
    x.roundRect(r.x, r.y, r.w, r.h, Math.min(radius, r.w / 2, r.h / 2))
  } else {
    x.rect(r.x, r.y, r.w, r.h)
  }
}

export function createMinimap(c: Ctx) {
  const d = c.d
  const cv = d.miniCv

  function readColors() {
    d.probe.style.color = 'var(--bd-ink)'
    c.colors.ink = getComputedStyle(d.probe).color
    d.probe.style.color = 'var(--bd-accent)'
    c.colors.accent = getComputedStyle(d.probe).color
  }

  function setMini(on: boolean) {
    c.miniOn = on
    d.miniBox.hidden = !on
    d.miniBtn.classList.toggle('is-on', on)
    d.miniBtn.setAttribute('aria-pressed', String(on))
    if (!on) return
    readColors()
    c.fx.invalidate()
  }

  function drawMini() {
    const dpr = window.devicePixelRatio || 1
    const MW = d.miniBox.clientWidth || 200
    const MH = d.miniBox.clientHeight || 128
    const pw = Math.round(MW * dpr)
    const ph = Math.round(MH * dpr)
    if (cv.width !== pw || cv.height !== ph) {
      cv.width = pw
      cv.height = ph
    }
    const x = cv.getContext('2d')
    if (!x) return
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    x.clearRect(0, 0, MW, MH)
    const v = viewWorld(c)
    let b = c.miniDrag?.b ?? union(contentBounds(c), v) ?? v
    if (!c.miniDrag) {
      const p = Math.max(b.w, b.h) * 0.06
      b = { x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p }
    }
    const k = Math.min(MW / b.w, MH / b.h)
    const ox = (MW - b.w * k) / 2 - b.x * k
    const oy = (MH - b.h * k) / 2 - b.y * k
    c.miniMap = { b, k, ox, oy }
    const box = (r: Rect, min = 0): Rect => ({
      x: r.x * k + ox,
      y: r.y * k + oy,
      w: Math.max(min, r.w * k),
      h: Math.max(min, r.h * k),
    })
    const { ink, accent } = c.colors
    x.fillStyle = ink
    x.strokeStyle = ink
    for (const g of c.groups.values()) {
      roundRect(x, box(g), 3)
      x.globalAlpha = c.sel.has(g.id) ? 0.12 : 0.05
      x.fill()
      x.globalAlpha = 0.12
      x.lineWidth = 1
      x.stroke()
    }
    for (const n of c.nodes.values()) {
      roundRect(x, box({ x: n.ax, y: n.ay, w: n.dw, h: n.dh }, 1.5), 1.5)
      if (c.sel.has(n.id)) {
        x.globalAlpha = 0.95
        x.fillStyle = accent
      } else {
        x.globalAlpha = n.status === 'ready' ? 0.3 : 0.12
        x.fillStyle = ink
      }
      x.fill()
    }
    x.globalAlpha = 1
    roundRect(x, box(v), 3)
    x.fillStyle = accent
    x.globalAlpha = 0.08
    x.fill()
    x.globalAlpha = 1
    x.strokeStyle = accent
    x.lineWidth = 1.5
    x.stroke()
  }

  /** Centres the view on the minimap point under the pointer. */
  function miniCenter(e: PointerEvent, animate: boolean) {
    const mm = c.miniMap
    if (!mm) return
    c.fitTarget = null
    const r = cv.getBoundingClientRect()
    const wx = (e.clientX - r.left - mm.ox) / mm.k
    const wy = (e.clientY - r.top - mm.oy) / mm.k
    const s = c.cam.s
    const to = { s, x: c.W / 2 - wx * s, y: c.H / 2 - wy * s }
    if (animate) {
      c.fx.animateCam(to, 360)
      return
    }
    c.fx.stopCam()
    c.cam.x = to.x
    c.cam.y = to.y
    c.fx.moving()
    c.fx.invalidate()
  }

  cv.addEventListener('pointerdown', (e) => {
    e.stopPropagation()
    try {
      cv.setPointerCapture(e.pointerId)
    } catch {
      // The pointer may already be gone.
    }
    c.miniDrag = {
      b: c.miniMap ? c.miniMap.b : null,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
    }
  })
  cv.addEventListener('pointermove', (e) => {
    const md = c.miniDrag
    if (!md || !cv.hasPointerCapture(e.pointerId)) return
    if (!md.moved && Math.hypot(e.clientX - md.sx, e.clientY - md.sy) < 3) {
      return
    }
    md.moved = true
    miniCenter(e, false)
  })
  cv.addEventListener('pointerup', (e) => {
    const md = c.miniDrag
    if (!md) return
    if (!md.moved) miniCenter(e, true)
    c.miniDrag = null
    c.fx.invalidate()
  })

  return { readColors, setMini, drawMini }
}
