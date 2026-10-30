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
import { elOf } from './dom'
import type { createInput } from './input'
import type { createPointer } from './pointer'

/* Hooks the canvas up to the page's events; returns the unhook. */

type Pointer = ReturnType<typeof createPointer>
type Input = ReturnType<typeof createInput>

export function wireCanvas(
  c: Ctx,
  pointer: Pointer,
  input: Input,
  onResize: () => void
): () => void {
  const el = c.d.el
  el.addEventListener('pointerdown', pointer.onDown)
  el.addEventListener('pointermove', pointer.onMove)
  el.addEventListener('pointerup', pointer.onUp)
  el.addEventListener('pointercancel', pointer.onUp)
  el.addEventListener('pointerenter', () => {
    c.pointerInside = true
  })
  el.addEventListener('pointerleave', () => {
    c.pointerInside = false
    if (!c.hoverId && !c.hoverG) return
    c.hoverId = null
    c.hoverG = null
    c.fx.invalidate()
  })
  el.addEventListener('wheel', pointer.onWheel, { passive: false })
  el.addEventListener('gesturestart', pointer.onGestureStart)
  el.addEventListener('gesturechange', pointer.onGestureChange)
  el.addEventListener('gestureend', pointer.onGestureEnd)
  el.addEventListener('contextmenu', c.fx.onContextMenu)
  el.addEventListener('dblclick', (e) => {
    // The press captured the pointer, so the event targets the canvas
    // itself: look up what is under the pointer instead.
    const under =
      typeof document.elementFromPoint === 'function'
        ? document.elementFromPoint(e.clientX, e.clientY)
        : null
    const t = under ?? elOf(e.target)
    const title = t?.closest<HTMLElement>('[data-cv-title]')
    if (title) {
      c.fx.startRename(title.dataset.cvTitle ?? '')
      return
    }
    const ne = t?.closest<HTMLElement>('.bd-cv-node')
    if (ne && c.tool === 'select') {
      c.fx.focus([ne.dataset.cvId ?? ''], { maxScale: 1 })
    }
  })
  window.addEventListener('keydown', input.onKey)
  window.addEventListener('keyup', input.onKeyUp)
  window.addEventListener('blur', input.onBlur)
  window.addEventListener('paste', input.onPaste)
  document.addEventListener('pointerdown', input.onDocDown, true)

  // jsdom (tests) has no ResizeObserver: measure once.
  const ro =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize)
  if (ro) ro.observe(el)
  else onResize()

  return () => {
    window.removeEventListener('keydown', input.onKey)
    window.removeEventListener('keyup', input.onKeyUp)
    window.removeEventListener('blur', input.onBlur)
    window.removeEventListener('paste', input.onPaste)
    document.removeEventListener('pointerdown', input.onDocDown, true)
    ro?.disconnect()
  }
}
