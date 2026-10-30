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
import { esc, translate } from './dom'
import { BARS_BOTTOM, clamp } from './geometry'
import { ICONS } from './icons'
import type { CanvasLabels } from './labels'
import { gRect, selNode } from './query'
import type { ActionSpec, Rect, SelectionKind } from './types'

/* The floating glass toolbar above the selection. */

export function imageActions(L: CanvasLabels): ActionSpec[] {
  return [
    { id: 'edit', label: L.edit, icon: ICONS.sparkles, primary: true },
    { id: 'mark', label: L.mark, icon: ICONS.lasso },
    { id: 'compare', label: L.compare, icon: ICONS.compare },
    { id: 'download', label: L.download, icon: ICONS.download },
    { id: 'copy-prompt', label: L.copyPrompt, icon: ICONS.copy },
    { id: 'more', label: L.more, icon: ICONS.more, iconOnly: true },
  ]
}

function failedActions(L: CanvasLabels): ActionSpec[] {
  return [
    {
      id: 'retry',
      label: L.retry,
      icon: ICONS.retry,
      primary: true,
      statuses: ['failed'],
    },
    {
      id: 'delete',
      label: L.delete,
      icon: ICONS.trash,
      iconOnly: true,
      statuses: ['failed'],
    },
  ]
}

function multiActions(L: CanvasLabels): ActionSpec[] {
  return [
    {
      id: 'compare',
      label: L.compare,
      icon: ICONS.compare,
      primary: true,
      exactly: 2,
    },
    { id: 'download', label: L.download, icon: ICONS.download },
    { id: 'delete', label: L.delete, icon: ICONS.trash },
  ]
}

function groupActions(L: CanvasLabels): ActionSpec[] {
  return [
    {
      id: 'export',
      label: L.exportSet,
      icon: ICONS.folderDown,
      primary: true,
    },
    { id: 'fit', label: L.viewSet, icon: ICONS.scan },
    { id: 'rename', label: L.rename, icon: ICONS.pen },
  ]
}

export function toolbarList(c: Ctx, kind: SelectionKind): ActionSpec[] {
  if (kind === 'group') return c.o.groupActions ?? groupActions(c.L)
  if (kind === 'multi') {
    const ids = [...c.sel]
    const allReady = ids.every((id) => c.nodes.get(id)?.status === 'ready')
    return (c.o.multiActions ?? multiActions(c.L)).filter(
      (a) =>
        (!a.exactly || a.exactly === ids.length) &&
        (a.id !== 'compare' || allReady)
    )
  }
  const n = selNode(c)
  if (!n) return []
  const list = (c.o.imageActions ?? imageActions(c.L)).filter((a) =>
    (a.statuses ?? ['ready']).includes(n.status)
  )
  if (!list.length && n.status === 'failed') return failedActions(c.L)
  return list
}

function buttonHtml(list: ActionSpec[], a: ActionSpec, i: number): string {
  const afterPrimary = i === 1 && list[0].primary
  const firstIcon = a.iconOnly && i > 0 && !list[i - 1].iconOnly
  const sep = afterPrimary || firstIcon ? '<i class="bd-cv-tb-sep"></i>' : ''
  const cls = `bd-cv-tb-btn${a.primary ? ' is-primary' : ''}${a.iconOnly ? ' is-icon' : ''}`
  const text = a.iconOnly ? '' : `<span>${esc(a.label)}</span>`
  return `${sep}<button type="button" class="${cls}" data-act="${esc(a.id)}" title="${esc(a.title || a.label)}" aria-label="${esc(a.label)}">${a.icon ?? ''}${text}</button>`
}

function buildToolbar(c: Ctx, kind: SelectionKind): boolean {
  const list = toolbarList(c, kind)
  const tb = c.d.tb
  tb.innerHTML = list.map((a, i) => buttonHtml(list, a, i)).join('')
  c.tbW = tb.offsetWidth
  c.tbH = tb.offsetHeight
  return list.length > 0
}

function busy(c: Ctx): boolean {
  const G = c.G
  if (!G) return false
  if (G.type === 'drag') return G.started
  if (G.type === 'gdrag') return G.moved
  return G.type === 'resize' || G.type === 'marquee' || G.type === 'mark'
}

/** Shows the toolbar above `bb` (the selection on screen), or hides it. */
export function placeToolbar(
  c: Ctx,
  kind: SelectionKind | null,
  bb: Rect | null,
  settling: boolean
) {
  const tb = c.d.tb
  const offScreen =
    !bb || bb.x >= c.W || bb.y >= c.H || bb.x + bb.w <= 0 || bb.y + bb.h <= 0
  const quiet = busy(c) || settling || c.tool === 'mark' || !!c.cmp || !!c.pick
  if (!kind || !bb || offScreen || quiet) {
    tb.classList.remove('is-on')
    return
  }
  const statuses = [...c.sel].map(
    (id) => `${id}:${c.nodes.get(id)?.status ?? 'g'}`
  )
  const key = `${kind}|${statuses.join(',')}`
  if (key !== c.tbKey) {
    c.tbKey = key
    tb.dataset.has = buildToolbar(c, kind) ? '1' : ''
  }
  if (!tb.dataset.has) {
    tb.classList.remove('is-on')
    return
  }
  const W = c.W
  const H = c.H
  const tbW = c.tbW
  const tbH = c.tbH
  const gap = kind === 'group' ? 38 : 12
  const x = clamp(bb.x + bb.w / 2 - tbW / 2, 8, Math.max(8, W - tbW - 8))
  const y0 = bb.y - tbH - gap
  let y = y0
  // Keep frame titles readable: go above a title band it would cover.
  for (const g of c.groups.values()) {
    const r = gRect(c, g)
    const top = r.y - 30
    if (x < r.x + r.w && x + tbW > r.x && y < r.y && y + tbH > top) {
      y = top - tbH - 6
    }
  }
  // Never under the page's bars at the top.
  const top = BARS_BOTTOM
  if (y < top && y0 >= top) y = y0
  if (y < top) {
    // Below the size label, or inside the picture near its top.
    y = bb.y + bb.h + 36
    if (y + tbH > H - 72) {
      y = clamp(bb.y + 12, top, Math.max(top, H - tbH - 72))
    }
  }
  tb.style.transform = translate(Math.round(x), Math.round(y))
  tb.classList.add('is-on')
}
