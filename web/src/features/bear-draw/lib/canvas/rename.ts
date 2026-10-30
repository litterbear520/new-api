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
import { report } from './dom'
import { pubG } from './query'

/* Renaming a frame in place: its title becomes editable text. */

export function createRename(c: Ctx) {
  function startRename(gid: string) {
    const g = c.groups.get(gid)
    if (!g) return
    if (c.renaming) commitRename()
    const nm = g.tEl.querySelector<HTMLElement>('.bd-cv-gt-name')
    if (!nm) return
    g.tEl.classList.add('is-editing')
    nm.contentEditable = 'plaintext-only'
    if (nm.contentEditable !== 'plaintext-only') nm.contentEditable = 'true'
    nm.spellcheck = false
    c.renaming = { g, nm, old: g.title }
    nm.focus()
    const range = document.createRange()
    range.selectNodeContents(nm)
    const s = window.getSelection()
    s?.removeAllRanges()
    s?.addRange(range)
    nm.addEventListener('keydown', renameKey)
    nm.addEventListener('blur', commitRename, { once: true })
  }

  function renameKey(e: KeyboardEvent) {
    e.stopPropagation()
    const r = c.renaming
    if (!r) return
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename()
      c.d.el.focus({ preventScroll: true })
    } else if (e.key === 'Escape') {
      e.preventDefault()
      r.nm.textContent = r.old
      commitRename()
      c.d.el.focus({ preventScroll: true })
    }
  }

  function commitRename() {
    const r = c.renaming
    if (!r) return
    c.renaming = null
    r.nm.removeEventListener('keydown', renameKey)
    r.nm.removeAttribute('contenteditable')
    r.g.tEl.classList.remove('is-editing')
    const title = (r.nm.textContent ?? '').trim().slice(0, 60) || r.old
    r.g.title = title
    c.fx.setTitle(r.g)
    if (title !== r.old) {
      try {
        c.o.onAction?.('rename', {
          ids: [r.g.id],
          kind: 'group',
          nodes: [],
          group: pubG(r.g),
          title,
        })
      } catch (err) {
        report(err)
      }
      c.fx.changed()
    }
    c.fx.invalidate()
  }

  return { startRename, commitRename }
}
