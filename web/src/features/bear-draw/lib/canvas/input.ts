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
import { elOf, isTyping, modalOpen, nothingFocused } from './dom'
import { local, measure, toWorld } from './query'

/*
 * Keyboard shortcuts (V H M, + −, ⇧1 ⇧2 ⇧0, ⌘A, Delete, Esc, arrows and
 * Space to pan) and pictures dropped on or pasted into the canvas.
 *
 * Where the keyboard is decides which keys count. The canvas itself
 * focused: all of them. A control inside it focused (a toolbar button, a
 * menu item): Space, Enter and the arrows stay with the control, the rest
 * count. Nothing focused and the pointer over the canvas: only keys with a
 * modifier or without a character (Delete, Esc, Space held to pan), since a
 * single character must not fire a shortcut there (WCAG 2.1.4). Focus
 * elsewhere on the page, typing, or a modal dialog open: none.
 */

type Scope = 'canvas' | 'control' | 'pointer'

const imageFiles = (list: FileList) =>
  [...list].filter((f) => !f.type || f.type.startsWith('image/'))

/** How far one arrow press moves the view, in screen px (Shift: ×5). */
const PAN_STEP = 48

const PAN_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [1, 0],
  ArrowRight: [-1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
}

export function createInput(c: Ctx) {
  const d = c.d

  function scope(): Scope | null {
    if (modalOpen(d.el)) return null
    const a = document.activeElement
    if (a === d.el) return 'canvas'
    if (a && d.el.contains(a)) return 'control'
    return nothingFocused() && c.pointerInside ? 'pointer' : null
  }

  function pan(e: KeyboardEvent, [dx, dy]: [number, number]) {
    e.preventDefault()
    const step = e.shiftKey ? PAN_STEP * 5 : PAN_STEP
    c.fx.stopCam()
    c.fitTarget = null
    c.cam.x += dx * step
    c.cam.y += dy * step
    c.fx.moving()
    c.fx.invalidate()
  }

  function commandKeys(e: KeyboardEvent) {
    const k = e.key
    if (k === '=' || k === '+') {
      e.preventDefault()
      c.fx.zoomIn()
    } else if (k === '-') {
      e.preventDefault()
      c.fx.zoomOut()
    } else if (k === '0') {
      e.preventDefault()
      c.fx.zoomTo(1)
    } else if (k.toLowerCase() === 'a') {
      e.preventDefault()
      c.fx.setSel([...c.nodes.keys()], true)
    }
  }

  /** Single characters: V H M, + −, ⇧1 ⇧2 ⇧0. */
  function charKeys(e: KeyboardEvent) {
    if (e.shiftKey && e.code === 'Digit1') {
      e.preventDefault()
      c.fx.fit()
      return
    }
    if (e.shiftKey && e.code === 'Digit2') {
      e.preventDefault()
      if (c.sel.size) c.fx.focus([...c.sel])
      return
    }
    if (e.shiftKey && e.code === 'Digit0') {
      e.preventDefault()
      c.fx.zoomTo(1)
      return
    }
    switch (e.key.toLowerCase()) {
      case 'v':
        c.fx.setTool('select')
        break
      case 'h':
        c.fx.setTool('hand')
        break
      case 'm':
        c.fx.setTool('mark')
        break
      case '=':
      case '+':
        c.fx.zoomIn()
        break
      case '-':
      case '_':
        c.fx.zoomOut()
        break
      default:
        break
    }
  }

  function escape() {
    const G = c.G
    if (c.pick) {
      c.fx.cancelPick()
    } else if (G?.type === 'mark') {
      G.path.remove()
      G.halo.remove()
      c.G = null
    } else if (c.tool !== 'select') {
      c.fx.setTool('select')
    } else {
      c.fx.setSel([], true)
    }
  }

  function onKey(e: KeyboardEvent) {
    // A hidden canvas (the page shows the chat only) leaves the keys alone,
    // and so does a key a control already handled.
    if (!c.alive || e.defaultPrevented || d.el.closest('[hidden]')) return
    const where = scope()
    if (!where) return
    // The comparison covers the canvas: Esc closes it; its slider and mode
    // buttons handle their own keys.
    if (c.cmp) {
      if (e.key === 'Escape' && !isTyping(e.target)) {
        e.preventDefault()
        c.fx.closeCompare()
      }
      return
    }
    if (c.menuEl && e.key === 'Escape') {
      e.preventDefault()
      c.fx.closeMenu(true)
      return
    }
    if (isTyping(e.target)) return
    if (e.key === ' ') {
      if (where === 'control') return
      e.preventDefault()
      if (!c.spaceDown) {
        c.spaceDown = true
        d.el.classList.add('is-space')
      }
      return
    }
    if (e.metaKey || e.ctrlKey) {
      commandKeys(e)
      return
    }
    if (e.altKey) return
    const dir = PAN_KEYS[e.key]
    if (dir) {
      if (where === 'canvas') pan(e, dir)
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (c.sel.size) {
        e.preventDefault()
        c.fx.act('delete', {})
      }
      return
    }
    if (e.key === 'Escape') {
      escape()
      return
    }
    if (where !== 'pointer') charKeys(e)
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key !== ' ') return
    c.spaceDown = false
    d.el.classList.remove('is-space')
  }

  function onBlur() {
    c.spaceDown = false
    d.el.classList.remove('is-space')
  }

  /** A press outside the open menu closes it (the zoom button toggles). */
  function onDocDown(e: PointerEvent) {
    const m = c.menuEl
    if (!m) return
    const t = elOf(e.target)
    if (t && (m.contains(t) || t.closest('[data-ui="zoom"]'))) return
    c.fx.closeMenu()
  }

  /** Pictures pasted while the canvas is in use go onto it. */
  function onPaste(e: ClipboardEvent) {
    if (!c.alive || isTyping(e.target) || !e.clipboardData || !scope()) return
    const files = imageFiles(e.clipboardData.files)
    if (!files.length) return
    e.preventDefault()
    const worldPoint = toWorld(c, { x: c.W / 2, y: c.H / 2 })
    c.fx.act('drop-files', { files, worldPoint })
  }

  const hasFiles = (e: DragEvent) =>
    !!e.dataTransfer && [...e.dataTransfer.types].includes('Files')

  d.el.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    d.dropEl.hidden = false
  })
  d.el.addEventListener('dragleave', (e) => {
    const to = e.relatedTarget
    if (!(to instanceof Node) || !d.el.contains(to)) d.dropEl.hidden = true
  })
  d.el.addEventListener('drop', (e) => {
    if (!hasFiles(e) || !e.dataTransfer) return
    e.preventDefault()
    d.dropEl.hidden = true
    measure(c)
    const files = imageFiles(e.dataTransfer.files)
    if (!files.length) return
    c.fx.act('drop-files', { files, worldPoint: toWorld(c, local(c, e)) })
  })

  return { onKey, onKeyUp, onBlur, onDocDown, onPaste }
}
