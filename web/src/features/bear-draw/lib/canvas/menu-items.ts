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
import type { Ctx, NodeRec } from './context'
import { elOf, esc, h, isTyping } from './dom'
import { ICONS } from './icons'
import {
  firstOf,
  local,
  measure,
  pub,
  pubG,
  pubNodes,
  selKind,
  selNode,
  toWorld,
} from './query'
import type {
  ActionPayload,
  MenuItem,
  MenuTarget,
  SelectionKind,
} from './types'

/* What the right-click and ⋯ menus offer for the selection. */

type Entry = Exclude<MenuItem, { sep: true }>

/** Already on the picture toolbar, so left out of its ⋯ menu. */
const ON_TOOLBAR = new Set([
  'edit',
  'mark',
  'compare',
  'download',
  'copy-prompt',
])

export function createMenuItems(c: Ctx) {
  function defaultMenu(
    kind: SelectionKind | null,
    n: NodeRec | null
  ): MenuItem[] {
    const L = c.L
    const del: Entry = {
      id: 'delete',
      label: L.delete,
      icon: ICONS.trash,
      danger: true,
    }
    if (kind === 'group') {
      return [
        { id: 'export', label: L.exportSet, icon: ICONS.folderDown },
        { id: 'fit', label: L.viewSet, icon: ICONS.scan },
        { id: 'rename', label: L.rename, icon: ICONS.pen },
        { sep: true },
        { ...del, label: L.deleteSet },
      ] satisfies MenuItem[]
    }
    if (kind === 'multi') {
      return [
        {
          id: 'download',
          label: L.downloadCount(c.sel.size),
          icon: ICONS.download,
        },
        { id: 'fit', label: L.viewThese, icon: ICONS.scan },
        { sep: true },
        del,
      ] satisfies MenuItem[]
    }
    if (n?.status === 'failed') {
      return [
        { id: 'retry', label: L.retry, icon: ICONS.retry },
        { sep: true },
        del,
      ] satisfies MenuItem[]
    }
    const fit: Entry = { id: 'fit', label: L.viewLarger, icon: ICONS.scan }
    if (n?.status === 'pending') return [fit, { sep: true }, del]
    return [
      { id: 'edit', label: L.edit, icon: ICONS.sparkles },
      { id: 'mark', label: L.markWhat, icon: ICONS.lasso, kbd: 'M' },
      { id: 'compare', label: L.compareWith, icon: ICONS.compare },
      { id: 'download', label: L.download, icon: ICONS.download },
      { id: 'copy-prompt', label: L.copyPrompt, icon: ICONS.copy },
      { sep: true },
      fit,
      { ...del, kbd: '⌫' },
    ] satisfies MenuItem[]
  }

  function menuItems(kind: SelectionKind | null): MenuItem[] {
    const n = selNode(c)
    const g = kind === 'group' ? c.groups.get(firstOf(c.sel) ?? '') : undefined
    if (c.o.contextMenu) {
      let target: MenuTarget = null
      if (n) target = pub(n)
      else if (g) target = pubG(g)
      else if (kind === 'multi') target = pubNodes(c, [...c.sel])
      const custom = c.o.contextMenu(target)
      if (Array.isArray(custom)) return custom
    }
    return defaultMenu(kind, n)
  }

  const costText = (usd: number) =>
    c.o.formatCost ? c.o.formatCost(usd) : `$${usd.toFixed(usd < 0.1 ? 3 : 2)}`

  /** Model, cost, time and description on top of a picture's menu. */
  function metaHead(n: NodeRec | null): HTMLElement | null {
    if (!n) return null
    const m = n.meta
    const bits = [
      m.model,
      m.cost != null ? costText(m.cost) : null,
      m.secs != null ? c.L.seconds(Math.round(m.secs)) : null,
    ].filter((b): b is string => !!b)
    if (!bits.length && !m.prompt) return null
    const row = bits.length
      ? `<div class="bd-cv-mh-row">${bits.map((b) => `<span>${esc(b)}</span>`).join('<i>·</i>')}</div>`
      : ''
    const prompt = m.prompt
      ? `<div class="bd-cv-mh-prompt">${esc(m.prompt)}</div>`
      : ''
    return h('div', 'bd-cv-menu-head', row + prompt)
  }

  function openMore(p: ActionPayload) {
    const kind = selKind(c)
    let items = menuItems(kind)
    if (!c.o.contextMenu && kind === 'image') {
      items = items.filter((it) => it.sep || !it.id || !ON_TOOLBAR.has(it.id))
    }
    const at = p.anchor ?? { x: c.W / 2, y: c.H / 2 }
    c.fx.openMenu(
      items,
      { x: at.x, y: at.y, align: 'center' },
      metaHead(selNode(c))
    )
  }

  function onContextMenu(e: MouseEvent) {
    const t = elOf(e.target)
    if (!t || t.closest('.bd-cv-ui') || isTyping(t)) return
    e.preventDefault()
    measure(c)
    const pt = local(c, e)
    const ne = t.closest<HTMLElement>('.bd-cv-node')
    const te = t.closest<HTMLElement>('[data-cv-title]')
    if (ne) {
      const id = ne.dataset.cvId ?? ''
      if (!c.sel.has(id)) c.fx.setSel([id], true)
    } else if (te) {
      c.fx.setSel([te.dataset.cvTitle ?? ''], true)
    } else {
      const L = c.L
      const worldPoint = toWorld(c, pt)
      const items: MenuItem[] = [
        { id: 'fit-all', label: L.fitAll, icon: ICONS.scan, kbd: '⇧1' },
        { id: 'zoom-100', label: L.zoom100, icon: ICONS.plus, kbd: '⇧0' },
        { sep: true },
        {
          id: 'upload',
          label: L.upload,
          icon: ICONS.upload,
          payload: { worldPoint },
        },
      ]
      c.fx.openMenu(items, pt)
      return
    }
    const kind = selKind(c)
    const head = kind === 'image' ? metaHead(selNode(c)) : null
    c.fx.openMenu(menuItems(kind), pt, head)
  }

  return { openMore, onContextMenu }
}
