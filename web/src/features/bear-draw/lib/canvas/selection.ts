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
import { markNode } from './query'
import type { Tool } from './types'
import { TOOLS } from './ui'

/* The selection and the active tool. */

function toIds(input: string[] | string | null): string[] {
  if (Array.isArray(input)) return input.map(String)
  return input == null ? [] : [String(input)]
}

export function createSelection(c: Ctx) {
  /** A frame is selected alone; `user` reports the change to the page. */
  function setSel(input: string[] | string | null, user: boolean) {
    let ids = toIds(input).filter((id) => c.nodes.has(id) || c.groups.has(id))
    const gid = ids.find((id) => c.groups.has(id))
    if (gid) ids = [gid]
    const same = ids.length === c.sel.size && ids.every((id) => c.sel.has(id))
    if (same) return
    c.sel = new Set(ids)
    for (const n of c.nodes.values()) {
      n.el.classList.toggle('is-sel', c.sel.has(n.id))
    }
    if (c.tool === 'mark') c.fx.renderPanel()
    c.fx.invalidate()
    if (user) c.o.onSelect?.([...c.sel])
  }

  function setTool(tool: Tool) {
    if (!TOOLS.includes(tool)) return
    c.tool = tool
    c.d.el.dataset.tool = tool
    for (const b of c.d.toolBtns) {
      const on = b.dataset.tool === tool
      b.classList.toggle('is-on', on)
      b.setAttribute('aria-pressed', String(on))
    }
    if (tool !== 'select' && c.pick) c.fx.cancelPick()
    if (tool === 'mark') {
      c.fx.closeMenu()
      if (!markNode(c)) c.fx.toast(c.L.markFirst, 2600)
    }
    c.fx.renderPanel()
    c.fx.invalidate()
  }

  return { setSel, setTool }
}
