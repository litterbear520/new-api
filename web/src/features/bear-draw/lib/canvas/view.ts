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
import { now, place, translate } from './dom'
import { clamp, mod } from './geometry'
import { gRect, markNode, nRect, sRect, selKind } from './query'
import { renderSelection } from './selection-view'
import type { Rect } from './types'

/*
 * The render loop: one rAF frame moves the world layer and redraws the
 * screen-space overlay (titles, hover, drop ghosts, selection, badges).
 */
export function createView(c: Ctx) {
  const d = c.d

  function invalidate() {
    if (!c.raf && c.alive) c.raf = requestAnimationFrame(frame)
  }

  /**
   * While the camera moves; settles into a saved state shortly after, and
   * pictures now shown bigger than their thumbnails get their full files.
   */
  function moving() {
    d.el.classList.add('is-moving')
    window.clearTimeout(c.timers.mov)
    c.timers.mov = window.setTimeout(() => {
      d.el.classList.remove('is-moving')
      c.fx.sharpen()
      changed()
    }, 170)
  }

  /** Frames and pictures glide to their new places for a moment. */
  function flowing() {
    d.world.classList.add('bd-cv-flowing')
    window.clearTimeout(c.timers.flow)
    c.timers.flow = window.setTimeout(
      () => d.world.classList.remove('bd-cv-flowing'),
      380
    )
  }

  /** Hides the selection until the glide is over. */
  function settle() {
    c.settleUntil = now() + 330
    window.clearTimeout(c.timers.settle)
    c.timers.settle = window.setTimeout(invalidate, 340)
  }

  function changed() {
    if (c.restoring) return
    window.clearTimeout(c.timers.ch)
    c.timers.ch = window.setTimeout(() => {
      if (c.alive) c.o.onChange?.(c.fx.getState())
    }, 250)
  }

  function toast(message: string, ms?: number) {
    d.toastEl.textContent = message
    d.toastEl.classList.add('is-on')
    window.clearTimeout(c.timers.toast)
    if (ms === 0) return
    c.timers.toast = window.setTimeout(
      () => d.toastEl.classList.remove('is-on'),
      ms || 1800
    )
  }

  function hideToast() {
    window.clearTimeout(c.timers.toast)
    d.toastEl.classList.remove('is-on')
  }

  /**
   * Titles keep their screen size, so far out they would sit on the frame
   * above: then they hide until there is room again. A selected frame keeps
   * its title (the handle to drag and rename it).
   */
  function renderTitles() {
    const kind = selKind(c)
    const rects = new Map<string, Rect>()
    for (const id of c.gOrder) {
      const g = c.groups.get(id)
      if (g) rects.set(id, gRect(c, g))
    }
    // Another frame ends in the strip the title would take.
    const crowded = (id: string, r: Rect) => {
      if (c.sel.has(id)) return false
      const top = r.y - 30
      const right = r.x + Math.max(r.w, 160)
      for (const [other, o] of rects) {
        if (other === id) continue
        const bottom = o.y + o.h
        if (o.x < right && o.x + o.w > r.x && bottom > top && bottom <= r.y) {
          return true
        }
      }
      return false
    }
    for (const id of c.gOrder) {
      const g = c.groups.get(id)
      const r = rects.get(id)
      if (!g || !r) continue
      const t = g.tEl
      const vis =
        r.x < c.W &&
        r.y - 30 < c.H &&
        r.x + r.w > 0 &&
        r.y + r.h > -10 &&
        !crowded(id, r)
      if (!vis) {
        if (t.style.display !== 'none') t.style.display = 'none'
        continue
      }
      if (t.style.display) t.style.display = ''
      t.style.transform = translate(r.x, r.y - 28)
      t.style.maxWidth = `${Math.max(480, r.w)}px`
      t.classList.toggle('is-sel', kind === 'group' && c.sel.has(id))
    }
  }

  function renderHover() {
    const busy = c.G && c.G.type !== 'pan' && c.G.type !== 'tap'
    let r: Rect | null = null
    let label = ''
    const n = c.hoverId ? c.nodes.get(c.hoverId) : undefined
    const g = c.hoverG ? c.groups.get(c.hoverG) : undefined
    if (!busy && n && !c.sel.has(n.id)) {
      r = nRect(c, n)
      label = n.label
    } else if (!busy && g && !c.sel.has(g.id)) {
      r = gRect(c, g)
    }
    if (!r) {
      d.hov.style.display = 'none'
      d.hovLabel.style.display = 'none'
      return
    }
    d.hov.style.display = ''
    place(d.hov, r)
    if (label && r.w > 120 && r.h > 60 && !c.hoverG) {
      d.hovLabel.style.display = ''
      if (d.hovLabel.textContent !== label) d.hovLabel.textContent = label
      d.hovLabel.style.transform = translate(r.x + 8, r.y + 8)
      d.hovLabel.style.maxWidth = `${r.w - 16}px`
    } else {
      d.hovLabel.style.display = 'none'
    }
  }

  /** Dashed boxes where the dragged pictures will land. */
  function renderGhosts() {
    const pool = d.ghostPool
    pool.begin()
    const G = c.G
    if (G?.type === 'drag' && G.started && G.target) {
      for (const id of G.ids) {
        const n = c.nodes.get(id)
        if (!n?.slot) continue
        place(pool.next(), sRect(c, n.slot.x, n.slot.y, n.dw, n.dh))
      }
    }
    pool.end()
  }

  function renderBadges() {
    const pool = d.badgePool
    pool.begin()
    const target = c.tool === 'mark' ? markNode(c) : null
    for (const n of c.nodes.values()) {
      if (!n.marks.length) continue
      const r = nRect(c, n)
      const off = r.x > c.W || r.y > c.H || r.x + r.w < 0 || r.y + r.h < 0
      if (r.w < 48 || off) continue
      for (const m of n.marks) {
        const b = pool.next()
        if (b.textContent !== String(m.n)) b.textContent = String(m.n)
        b.classList.toggle('is-dim', !!target && target !== n)
        b.style.transform = translate(r.x + m.ax * r.w, r.y + m.ay * r.h)
      }
    }
    pool.end()
  }

  function frame() {
    c.raf = 0
    if (!c.alive) return
    const s = c.cam.s
    d.world.style.transform = `translate3d(${c.cam.x}px,${c.cam.y}px,0) scale(${s})`
    // The dot grid follows the zoom and fades out when the dots get dense.
    const gs = 24 * s
    const ga = clamp((gs - 7) / 9, 0, 1)
    d.grid.style.opacity = String(ga)
    if (ga > 0) {
      d.grid.style.backgroundSize = `${gs}px ${gs}px`
      d.grid.style.backgroundPosition = `${mod(c.cam.x - gs / 2, gs)}px ${mod(c.cam.y - gs / 2, gs)}px`
    }
    // Mark strokes keep about 3 screen px.
    for (const n of c.nodes.values()) {
      if (n.svg) n.svg.style.setProperty('--bd-cv-sw', String(3000 / s / n.dw))
    }
    renderTitles()
    renderHover()
    renderGhosts()
    renderSelection(c)
    renderBadges()
    if (c.miniOn) c.fx.drawMini()
    const zt = `${Math.round(s * 100)}%`
    if (zt !== c.zoomTxt) {
      c.zoomTxt = zt
      d.zoomPct.textContent = zt
    }
  }

  return {
    invalidate,
    frame,
    moving,
    flowing,
    settle,
    changed,
    toast,
    hideToast,
  }
}
