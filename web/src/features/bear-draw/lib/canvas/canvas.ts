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
import { useNightSeaStore } from '@/stores/night-sea-store'

import { createActions } from './actions'
import { createCamera } from './camera'
import { createCompare } from './compare'
import type { Ctx, Fx } from './context'
import { createDrag } from './drag'
import { clamp, MAX_S, MIN_S } from './geometry'
import { createGroups } from './groups'
import { createInput } from './input'
import { DEFAULT_LABELS, mergeLabels } from './labels'
import { createMarkPanel } from './mark-panel'
import { createMarks } from './marks'
import { createMedia } from './media'
import { createMenuItems } from './menu-items'
import { createMenus } from './menus'
import { createMinimap } from './minimap'
import { createNodes } from './nodes'
import { createPointer } from './pointer'
import { contentBounds, measure, pub, pubG } from './query'
import { createRename } from './rename'
import { createSelection } from './selection'
import { createStateIo } from './state'
import type { CanvasApi, CanvasOptions, CanvasTheme } from './types'
import { applyStaticLabels, buildDom } from './ui'
import { createView } from './view'
import { wireCanvas } from './wire'

/*
 * The drawing page's infinite canvas, framework-free. Frames hold sets of
 * pictures in rows; pictures can be dragged between frames or left free,
 * resized, circled (圈选), compared, downloaded. See types.ts for the API.
 */
export function createCanvas(
  root: HTMLElement,
  opts: CanvasOptions = {}
): CanvasApi {
  // Filled right below; the modules only call it after creation.
  const fx = {} as Fx
  const c: Ctx = {
    o: opts,
    L: mergeLabels(DEFAULT_LABELS, opts.labels),
    d: buildDom(root),
    groups: new Map(),
    nodes: new Map(),
    gOrder: [],
    cam: { x: 80, y: 80, s: 1 },
    W: 0,
    H: 0,
    rect: { left: 0, top: 0 },
    sel: new Set(),
    tool: 'select',
    G: null,
    hoverId: null,
    hoverG: null,
    pick: null,
    raf: 0,
    camAnim: 0,
    timers: { mov: 0, ch: 0, flow: 0, toast: 0, focus: 0, settle: 0 },
    follow: null,
    fitTarget: null,
    settleUntil: 0,
    camInit: false,
    restoring: false,
    alive: true,
    spaceDown: false,
    pointerInside: false,
    miniOn: !!opts.minimap,
    miniMap: null,
    miniDrag: null,
    menuEl: null,
    cmp: null,
    renaming: null,
    tbKey: '',
    tbW: 0,
    tbH: 0,
    zoomTxt: '',
    theme: 'light',
    themeExplicit: false,
    touches: new Map(),
    gesture: { s: 1, p: null },
    colors: { ink: '#111', accent: '#3b82f6' },
    fx,
  }
  const d = c.d

  function applyTheme(theme: CanvasTheme) {
    c.theme = theme === 'dark' ? 'dark' : 'light'
    d.el.classList.toggle('bd-cv-dark', c.theme === 'dark')
    // The night palette (base.css) for the canvas itself, under the night sea.
    d.el.classList.toggle(
      'bd-night',
      c.theme === 'dark' && useNightSeaStore.getState().on
    )
    fx.readColors()
    fx.invalidate()
  }

  Object.assign(fx, {
    ...createView(c),
    ...createSelection(c),
    ...createGroups(c),
    ...createNodes(c),
    ...createMedia(c),
    ...createCamera(c),
    ...createDrag(c),
    ...createMarks(c),
    ...createMarkPanel(c),
    ...createActions(c),
    ...createMenus(c),
    ...createMenuItems(c),
    ...createRename(c),
    ...createCompare(c),
    ...createMinimap(c),
    ...createStateIo(c),
    applyTheme,
  } satisfies Fx)

  const unwire = wireCanvas(c, createPointer(c), createInput(c), onResize)

  /**
   * The pane may still be opening (its width animates): until the user
   * moves the camera, every new size fits the content again.
   */
  function onResize() {
    const w = d.el.clientWidth
    const hh = d.el.clientHeight
    if (!w || !hh) return
    const resized = w !== c.W || hh !== c.H
    c.W = w
    c.H = hh
    measure(c)
    if (!c.camInit && contentBounds(c)) {
      c.camInit = true
      c.fitTarget ??= 'all'
    }
    if (resized && c.fitTarget) fx.focus(c.fitTarget, { animate: false })
    // More of the world may show: sharpen it once the size rests.
    else if (resized) fx.moving()
    if (c.cmp) fx.renderCompare()
    fx.invalidate()
  }

  // Follows the page theme until the page sets one (setTheme).
  const detectTheme = (): CanvasTheme =>
    document.documentElement.classList.contains('dark') &&
    root.closest('.bd-night')
      ? 'dark'
      : 'light'
  const mo = new MutationObserver(() => {
    if (!c.themeExplicit && detectTheme() !== c.theme) applyTheme(detectTheme())
    fx.readColors()
    fx.invalidate()
  })
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  applyStaticLabels(d, c.L)
  fx.setMini(c.miniOn)
  fx.setTool('select')
  applyTheme(detectTheme())

  function destroy() {
    if (!c.alive) return
    c.alive = false
    if (c.raf) cancelAnimationFrame(c.raf)
    fx.stopCam()
    for (const t of Object.values(c.timers)) window.clearTimeout(t)
    for (const n of c.nodes.values()) n.dead = true
    unwire()
    mo.disconnect()
    d.el.remove()
  }

  return {
    el: d.el,
    addGroup: (spec) => fx.addGroup(spec ?? {}),
    updateGroup: (id, patch) => fx.updateGroup(String(id), patch),
    addImage: (spec) => fx.addImage(spec ?? {}),
    updateImage: (id, patch) => fx.updateImage(String(id), patch),
    remove: (id) => fx.remove(String(id)),
    select: (ids) => fx.setSel(ids, false),
    getSelection: () => [...c.sel],
    getNode: (id) => {
      const n = c.nodes.get(String(id))
      if (n) return pub(n)
      const g = c.groups.get(String(id))
      return g ? pubG(g) : null
    },
    focus: (ids, opt) => {
      c.follow = null
      window.clearTimeout(c.timers.focus)
      fx.focus(ids, { animate: true, ...opt })
    },
    setTool: fx.setTool,
    getTool: () => c.tool,
    zoomTo: fx.zoomTo,
    zoomIn: fx.zoomIn,
    zoomOut: fx.zoomOut,
    fit: fx.fit,
    getCamera: () => ({ ...c.cam }),
    setCamera: (cam, opt) => {
      const to = {
        x: Number(cam.x) || 0,
        y: Number(cam.y) || 0,
        s: Number(cam.s) || 1,
      }
      c.fitTarget = null
      if (opt?.animate) {
        fx.animateCam(to)
        return
      }
      fx.stopCam()
      c.cam.x = to.x
      c.cam.y = to.y
      c.cam.s = clamp(to.s, MIN_S, MAX_S)
      fx.invalidate()
    },
    compare: (a, b) => fx.compare(a, b),
    closeCompare: () => fx.closeCompare(),
    clearMarks: (id) => fx.clearMarks(id),
    setMinimap: (on) => fx.setMini(!!on),
    toast: (message, ms) => fx.toast(message, ms),
    getState: fx.getState,
    setState: fx.setState,
    setTheme: (theme) => {
      c.themeExplicit = true
      applyTheme(theme)
    },
    getTheme: () => c.theme,
    setLabels: (labels) => {
      c.L = mergeLabels(c.L, labels)
      applyStaticLabels(d, c.L)
      c.tbKey = ''
      for (const g of c.groups.values()) fx.setTitle(g)
      for (const n of c.nodes.values()) {
        if (n.status === 'failed') fx.renderMedia(n, false)
      }
      if (c.tool === 'mark') fx.renderPanel()
      fx.invalidate()
    },
    destroy,
  }
}
