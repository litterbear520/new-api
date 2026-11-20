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
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createCanvas } from '../lib/canvas/canvas'
import type { CanvasApi } from '../lib/canvas/types'

/* The canvas from the keyboard: which keys count where, toolbars, menus, 对比. */

const made: CanvasApi[] = []
let resize = () => {}

/** A 1000×600 canvas; jsdom has no layout, so the size is set by hand. */
function canvas(): CanvasApi {
  const root = document.createElement('div')
  document.body.append(root)
  const cv = createCanvas(root, { autoFocus: false })
  made.push(cv)
  Object.defineProperty(cv.el, 'clientWidth', { value: 1000 })
  Object.defineProperty(cv.el, 'clientHeight', { value: 600 })
  resize()
  return cv
}

/** Two finished pictures of the same shape, side by side. */
function twoPictures(cv: CanvasApi) {
  cv.setCamera({ x: 0, y: 0, s: 0.25 })
  cv.addImage({ id: 'a', x: 200, y: 400, w: 800, h: 800, src: 'blob:a' })
  cv.addImage({ id: 'b', x: 1200, y: 400, w: 800, h: 800, src: 'blob:b' })
}

/** Sends a key to whatever has the focus (or the page). */
function press(key: string, opts: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  })
  const target = document.activeElement ?? document.body
  target.dispatchEvent(e)
  return e
}

const pointerOver = (cv: CanvasApi) =>
  cv.el.dispatchEvent(new Event('pointerenter'))

const q = <T extends HTMLElement = HTMLElement>(cv: CanvasApi, sel: string) =>
  cv.el.querySelector<T>(sel)

const focused = () => document.activeElement as HTMLElement | null

/** The selection settles and the picture toolbar is drawn. */
const settle = () => new Promise((r) => setTimeout(r, 400))
const nextFrame = () =>
  new Promise<void>((r) => requestAnimationFrame(() => r()))

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resize = cb
      }
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal('devicePixelRatio', 1)
  HTMLImageElement.prototype.decode = () => Promise.resolve()
})

afterEach(() => {
  for (const cv of made.splice(0)) cv.destroy()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('which keys count where', () => {
  test('Space and Enter on a canvas button go to the button, not to panning', () => {
    const cv = canvas()
    const hand = q(cv, '.bd-cv-tools [data-tool="hand"]')
    hand?.focus()
    const e = press(' ')
    expect(e.defaultPrevented).toBe(false)
    expect(cv.el.classList.contains('is-space')).toBe(false)
  })

  test('Space held on the canvas itself still pans', () => {
    const cv = canvas()
    cv.el.focus()
    expect(press(' ').defaultPrevented).toBe(true)
    expect(cv.el.classList.contains('is-space')).toBe(true)
  })

  test('with the focus elsewhere on the page, the pointer over the canvas does not make keys count', () => {
    const cv = canvas()
    twoPictures(cv)
    cv.select(['a'])
    const other = document.createElement('button')
    document.body.append(other)
    other.focus()
    pointerOver(cv)
    press('m')
    press('Delete')
    expect(cv.getTool()).toBe('select')
    expect(cv.getNode('a')).not.toBeNull()
  })

  test('with nothing focused and the pointer over the canvas, single characters do nothing but Delete works', () => {
    const cv = canvas()
    twoPictures(cv)
    cv.select(['a'])
    pointerOver(cv)
    press('m')
    expect(cv.getTool()).toBe('select')
    press('Delete')
    expect(cv.getNode('a')).toBeNull()
  })

  test('an open modal dialog stops every canvas key', () => {
    const cv = canvas()
    twoPictures(cv)
    cv.select(['a'])
    pointerOver(cv)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    document.body.append(dialog)
    press('Delete')
    expect(cv.getNode('a')).not.toBeNull()
    dialog.remove()
    // Base UI hides the rest of the page instead.
    cv.el.parentElement?.setAttribute('aria-hidden', 'true')
    cv.el.focus()
    press('h')
    expect(cv.getTool()).toBe('select')
  })

  test('single characters work on the canvas and on a canvas button', () => {
    const cv = canvas()
    cv.el.focus()
    press('h')
    expect(cv.getTool()).toBe('hand')
    q(cv, '.bd-cv-tools [data-tool="select"]')?.focus()
    press('m')
    expect(cv.getTool()).toBe('mark')
  })
})

describe('arrow keys pan the view', () => {
  test('on the canvas, one step per press, five with Shift', () => {
    const cv = canvas()
    cv.setCamera({ x: 100, y: 100, s: 1 })
    cv.el.focus()
    expect(press('ArrowRight').defaultPrevented).toBe(true)
    expect(cv.getCamera()).toMatchObject({ x: 52, y: 100 })
    press('ArrowUp', { shiftKey: true })
    expect(cv.getCamera()).toMatchObject({ x: 52, y: 340 })
  })

  test('not while a toolbar button has the focus', () => {
    const cv = canvas()
    cv.setCamera({ x: 100, y: 100, s: 1 })
    q(cv, '.bd-cv-tools button')?.focus()
    press('ArrowDown')
    expect(cv.getCamera()).toMatchObject({ x: 100, y: 100 })
  })
})

describe('toolbars take one Tab stop', () => {
  test('the tool bar: one button in the Tab order, arrows, Home and End move', () => {
    const cv = canvas()
    const bar = q(cv, '.bd-cv-tools')
    const buttons = [...(bar?.querySelectorAll('button') ?? [])]
    expect(buttons.map((b) => b.tabIndex)).toEqual([0, -1, -1, -1])
    buttons[0].focus()
    press('ArrowRight')
    expect(focused()).toBe(buttons[1])
    expect(buttons.map((b) => b.tabIndex)).toEqual([-1, 0, -1, -1])
    press('End')
    expect(focused()).toBe(buttons[3])
    press('ArrowRight')
    expect(focused()).toBe(buttons[0])
    press('ArrowLeft')
    expect(focused()).toBe(buttons[3])
    press('Home')
    expect(focused()).toBe(buttons[0])
  })

  test('the picture toolbar: one Tab stop, kept on the same action when it is rebuilt', async () => {
    const cv = canvas()
    twoPictures(cv)
    cv.select(['a'])
    await settle()
    await nextFrame()
    const tb = q(cv, '.bd-cv-tb')
    expect(tb?.getAttribute('focusgroup')).toBe('toolbar wrap')
    const stops = () =>
      [...(tb?.querySelectorAll<HTMLElement>('button') ?? [])].filter(
        (b) => b.tabIndex === 0
      )
    expect(stops()).toHaveLength(1)
    stops()[0].focus()
    press('ArrowRight')
    const act = focused()?.dataset.act
    expect(act).toBe('mark')
    // New labels rebuild the toolbar.
    cv.setLabels({ edit: 'Edit' })
    await nextFrame()
    expect(stops()).toHaveLength(1)
    expect(focused()?.dataset.act).toBe(act)
  })
})

describe('canvas menus give the focus back', () => {
  test('Esc closes the zoom menu and focuses the zoom button', () => {
    const cv = canvas()
    const zoom = q(cv, '[data-ui="zoom"]')
    zoom?.focus()
    zoom?.click()
    expect(zoom?.getAttribute('aria-expanded')).toBe('true')
    expect(focused()?.getAttribute('role')).toBe('menuitem')
    press('Escape')
    expect(q(cv, '.bd-cv-menu')).toBeNull()
    expect(focused()).toBe(zoom)
    expect(zoom?.getAttribute('aria-expanded')).toBe('false')
  })

  test('Tab leaves the menu from its trigger and closes it', () => {
    const cv = canvas()
    const zoom = q(cv, '[data-ui="zoom"]')
    zoom?.click()
    const e = press('Tab')
    expect(e.defaultPrevented).toBe(false)
    expect(q(cv, '.bd-cv-menu')).toBeNull()
    expect(focused()).toBe(zoom)
  })

  test('choosing an item gives the focus back before the item runs', () => {
    const cv = canvas()
    const zoom = q(cv, '[data-ui="zoom"]')
    zoom?.click()
    q(cv, '.bd-cv-menu [role="menuitem"]')?.click()
    expect(q(cv, '.bd-cv-menu')).toBeNull()
    expect(focused()).toBe(zoom)
  })
})

describe('对比 from the keyboard', () => {
  async function openFromToolbar(cv: CanvasApi) {
    twoPictures(cv)
    cv.select(['a', 'b'])
    await settle()
    await nextFrame()
    const btn = q(cv, '.bd-cv-tb [data-act="compare"]')
    btn?.focus()
    btn?.click()
    return btn
  }

  test('the focus goes in (to the slider); the two modes are one radio group', async () => {
    const cv = canvas()
    await openFromToolbar(cv)
    const group = q(cv, '.bd-cv-cmp [role="radiogroup"]')
    const radios = [
      ...(group?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []),
    ]
    expect(group?.getAttribute('aria-label')).toBe('Compare view')
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
    ])
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1])
    expect(focused()).toBe(q(cv, '.bd-cv-cmp [role="slider"]'))

    radios[0].focus()
    press('ArrowRight')
    expect(focused()).toBe(radios[1])
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
    ])
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0])
    expect(q(cv, '.bd-cv-cmp-side')).not.toBeNull()
  })

  test('the divider moves only while the slider has the focus', async () => {
    const cv = canvas()
    await openFromToolbar(cv)
    const slider = () => q(cv, '.bd-cv-cmp [role="slider"]')
    q(cv, '.bd-cv-cmp-x')?.focus()
    press('ArrowRight')
    expect(slider()?.getAttribute('aria-valuenow')).toBe('50')
    slider()?.focus()
    press('ArrowRight')
    expect(slider()?.getAttribute('aria-valuenow')).toBe('55')
    press('End')
    expect(slider()?.getAttribute('aria-valuenow')).toBe('100')
  })

  test('Esc closes it and the toolbar button that opened it gets the focus back', async () => {
    const cv = canvas()
    await openFromToolbar(cv)
    press('Escape')
    expect(q(cv, '.bd-cv-cmp:not(.is-out)')).toBeNull()
    await nextFrame()
    await nextFrame()
    expect(focused()?.dataset.act).toBe('compare')
    expect(q(cv, '.bd-cv-tb')?.contains(focused())).toBe(true)
  })

  test('closed with its button, the focus goes to the canvas when the opener is gone', () => {
    const cv = canvas()
    twoPictures(cv)
    cv.compare('a', 'b')
    expect(q(cv, '.bd-cv-cmp')?.contains(focused())).toBe(true)
    q(cv, '.bd-cv-cmp-x')?.click()
    expect(focused()).toBe(cv.el)
  })

  test('two shapes (side by side): the focus goes to the close button, Esc brings it back', () => {
    const cv = canvas()
    cv.addImage({ id: 'a', x: 0, y: 0, w: 800, h: 800, src: 'blob:a' })
    cv.addImage({ id: 'b', x: 900, y: 0, w: 800, h: 1200, src: 'blob:b' })
    cv.el.focus()
    cv.compare('a', 'b')
    expect(q(cv, '.bd-cv-cmp [role="radiogroup"]')).toBeNull()
    expect(focused()).toBe(q(cv, '.bd-cv-cmp-x'))
    press('Escape')
    expect(focused()).toBe(cv.el)
  })
})
