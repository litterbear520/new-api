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
import type { Corner, Dom } from './context'
import { h, mkPool } from './dom'
import { ICONS } from './icons'
import type { CanvasLabels } from './labels'
import type { Tool } from './types'

/*
 * The canvas DOM. One transformed world layer holds frames and pictures;
 * a screen-space overlay holds frame titles, selection, handles, mark
 * badges and the floating toolbar, so they keep a constant size. The fixed
 * UI (bottom bars, minimap, 圈选 panel, toast) sits on top.
 */

export const TOOLS: readonly Tool[] = ['select', 'hand', 'mark']
export const CORNERS: readonly Corner[] = ['nw', 'ne', 'sw', 'se']

const TOOL_ICON: Record<Tool, string> = {
  select: ICONS.select,
  hand: ICONS.hand,
  mark: ICONS.lasso,
}

function button(cls: string, html: string): HTMLButtonElement {
  const b = h('button', cls, html)
  b.type = 'button'
  return b
}

export function buildDom(root: HTMLElement): Dom {
  if (getComputedStyle(root).position === 'static') {
    root.style.position = 'relative'
  }
  const el = h('div', 'bd-cv')
  el.tabIndex = 0
  el.dataset.tool = 'select'
  el.setAttribute('role', 'application')
  const grid = h('div', 'bd-cv-grid')
  const world = h('div', 'bd-cv-world')
  const framesL = h('div', 'bd-cv-frames')
  const nodesL = h('div', 'bd-cv-nodes')
  world.append(framesL, nodesL)

  const ov = h('div', 'bd-cv-overlay')
  const titlesL = h('div', 'bd-cv-titles')
  const ghostL = h('div', 'bd-cv-ghosts')
  const badgeL = h('div', 'bd-cv-badges')
  const selL = h('div', 'bd-cv-selwrap')
  const hov = h('div', 'bd-cv-hov')
  const hovLabel = h('div', 'bd-cv-hov-label')
  const mq = h('div', 'bd-cv-mq')
  const sizeL = h('div', 'bd-cv-size')
  const tb = h('div', 'bd-cv-tb')
  tb.setAttribute('role', 'toolbar')
  const unionBox = h('div', 'bd-cv-sel is-union')
  const handles = CORNERS.map((k) => {
    const e = h('div', `bd-cv-hd is-${k}`)
    e.dataset.cvHandle = k
    return e
  })
  ov.append(titlesL, ghostL, hov, hovLabel, badgeL, selL, mq, tb)
  selL.append(unionBox, ...handles, sizeL)

  const tools = h('div', 'bd-cv-bar bd-cv-tools')
  tools.setAttribute('role', 'toolbar')
  const toolBtns = TOOLS.map((t) => {
    const b = button('', `${TOOL_ICON[t]}<span></span>`)
    b.dataset.tool = t
    b.setAttribute('aria-pressed', 'false')
    return b
  })
  const uploadBtn = button('', `${ICONS.upload}<span></span>`)
  uploadBtn.dataset.ui = 'upload'
  tools.append(...toolBtns, h('i', 'bd-cv-bar-sep'), uploadBtn)

  const zoomBar = h('div', 'bd-cv-bar bd-cv-zoom')
  const miniBtn = button('is-icon', ICONS.map)
  miniBtn.dataset.ui = 'mini'
  miniBtn.setAttribute('aria-pressed', 'false')
  const zoomBtn = button('bd-cv-zoom-pct', '')
  zoomBtn.dataset.ui = 'zoom'
  zoomBtn.setAttribute('aria-haspopup', 'menu')
  const zoomPct = h('span')
  zoomPct.textContent = '100%'
  zoomBtn.append(zoomPct)
  zoomBtn.insertAdjacentHTML('beforeend', ICONS.chevron)
  zoomBar.append(miniBtn, h('i', 'bd-cv-bar-sep'), zoomBtn)

  const miniBox = h('div', 'bd-cv-mini')
  miniBox.hidden = true
  const miniCv = h('canvas')
  miniBox.append(miniCv)
  const panel = h('div', 'bd-cv-panel')
  panel.hidden = true
  const toastEl = h('div', 'bd-cv-toast')
  toastEl.setAttribute('role', 'status')
  toastEl.setAttribute('aria-live', 'polite')
  const dropEl = h('div', 'bd-cv-drop')
  dropEl.hidden = true
  const dropTxt = h('span')
  const dropInner = h('div', '', ICONS.upload)
  dropInner.append(dropTxt)
  dropEl.append(dropInner)

  const ui = h('div', 'bd-cv-ui')
  ui.append(tools, zoomBar, miniBox, panel, toastEl, dropEl)
  const probe = h('span', 'bd-cv-probe')
  el.append(grid, world, ov, ui, probe)
  root.append(el)

  return {
    root,
    el,
    grid,
    world,
    framesL,
    nodesL,
    titlesL,
    hov,
    hovLabel,
    selL,
    mq,
    sizeL,
    tb,
    unionBox,
    handles,
    ui,
    tools,
    toolBtns,
    uploadBtn,
    miniBtn,
    zoomBtn,
    zoomPct,
    miniBox,
    miniCv,
    panel,
    toastEl,
    dropEl,
    dropTxt,
    probe,
    boxPool: mkPool(selL, 'bd-cv-sel'),
    badgePool: mkPool(badgeL, 'bd-cv-badge'),
    ghostPool: mkPool(ghostL, 'bd-cv-ghost'),
  }
}

function setBarLabel(b: HTMLButtonElement, name: string, tip: string) {
  b.title = tip
  const span = b.querySelector('span')
  if (span) span.textContent = name
}

/** Text of the parts built once (bars, names for assistive tech). */
export function applyStaticLabels(d: Dom, L: CanvasLabels) {
  d.el.setAttribute('aria-label', L.canvas)
  d.tb.setAttribute('aria-label', L.pictureActions)
  d.tools.setAttribute('aria-label', L.canvasTools)
  const names: Record<Tool, [string, string]> = {
    select: [L.select, L.selectTip],
    hand: [L.hand, L.handTip],
    mark: [L.mark, L.markTip],
  }
  for (const b of d.toolBtns) {
    const tool = TOOLS.find((t) => t === b.dataset.tool)
    if (tool) setBarLabel(b, names[tool][0], names[tool][1])
  }
  setBarLabel(d.uploadBtn, L.upload, L.uploadTip)
  d.miniBtn.title = L.minimap
  d.miniBtn.setAttribute('aria-label', L.minimap)
  d.zoomBtn.title = L.zoom
  d.zoomBtn.setAttribute('aria-label', L.zoom)
  d.miniCv.setAttribute('aria-label', L.minimap)
  d.dropTxt.textContent = L.dropHint
}
