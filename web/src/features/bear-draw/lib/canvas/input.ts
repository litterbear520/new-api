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
import { elOf, isTyping } from './dom'
import { local, measure, toWorld } from './query'

/*
 * Keyboard shortcuts (V H M, + −, ⇧1 ⇧2 ⇧0, ⌘A, Delete, Esc, Space to pan)
 * and pictures dropped on or pasted into the canvas. Keys count while the
 * pointer is over the canvas or it has the focus, and never while typing.
 */

const imageFiles = (list: FileList) =>
  [...list].filter((f) => !f.type || f.type.startsWith('image/'))

export function createInput(c: Ctx) {
  const d = c.d
  const hot = () => c.pointerInside || d.el.contains(document.activeElement)

  function compareKeys(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      c.fx.closeCompare()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      c.fx.nudgeCompare(-0.05)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      c.fx.nudgeCompare(0.05)
    }
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
    // A hidden canvas (the page shows the chat only) leaves the keys alone.
    if (!c.alive || d.el.closest('[hidden]')) return
    // The comparison covers the canvas; typing elsewhere keeps its keys.
    if (c.cmp && !isTyping(e.target)) {
      compareKeys(e)
      return
    }
    if (c.menuEl && e.key === 'Escape') {
      e.preventDefault()
      c.fx.closeMenu()
      d.el.focus({ preventScroll: true })
      return
    }
    if (isTyping(e.target) || !hot()) return
    if (e.key === ' ') {
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
      case 'delete':
      case 'backspace':
        if (c.sel.size) {
          e.preventDefault()
          c.fx.act('delete', {})
        }
        break
      case 'escape':
        escape()
        break
      default:
        break
    }
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
    if (!c.alive || isTyping(e.target) || !hot() || !e.clipboardData) return
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
