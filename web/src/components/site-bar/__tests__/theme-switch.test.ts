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
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  arcAngle,
  landing,
  nextLook,
  pairDots,
  rubber,
  staysDark,
  ThemeSwitch,
  veilOpacity,
  type ThemeLook,
} from '@/components/site-bar/theme-switch'

const labels = {
  light: 'to light',
  dark: 'to dark',
  night: 'to night',
}

// Frames run by hand, so a test can stop part-way through a move.
let queued = new Map<number, FrameRequestCallback>()
let nextId = 1
let clock = 1000
const realMatchMedia = window.matchMedia

function setReducedMotion(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: reduced && query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
}

function frames(count: number, ms = 16) {
  for (let i = 0; i < count; i++) {
    const due = [...queued.values()]
    queued = new Map()
    clock += ms
    for (const callback of due) callback(clock)
  }
}
const settle = () => frames(120)

beforeEach(() => {
  queued = new Map()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queued.set(nextId, callback)
    return nextId++
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queued.delete(id))
  // motion on: the suite's default is reduced motion
  setReducedMotion(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: realMatchMedia,
  })
  document.body.replaceChildren()
  document.head.querySelectorAll('style').forEach((node) => node.remove())
})

function mount(look: ThemeLook = 'dark', extra = {}) {
  const host = document.createElement('button')
  document.body.append(host)
  host.getBoundingClientRect = () => ({ width: 62 }) as DOMRect
  const seen: ThemeLook[] = []
  const themeSwitch = new ThemeSwitch(host, {
    look,
    pinned: false,
    nightFound: false,
    labels,
    onLook: (next) => seen.push(next),
    ...extra,
  })
  const pointer = (type: string, clientX: number, detail = {}) =>
    host.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        button: 0,
        clientX,
        ...detail,
      })
    )
  const knob = host.querySelector<HTMLElement>('.tsw-knob') as HTMLElement
  const x = () => Number.parseFloat(knob.style.translate)
  const veil = () => document.querySelector<HTMLElement>('.tsw-veil')
  return { host, themeSwitch, seen, pointer, knob, x, veil }
}

/** A press at 100 and moves in steps of one frame, ending at 100 + `dx`. */
function dragBy(view: ReturnType<typeof mount>, dx: number, steps = 8) {
  view.pointer('pointerdown', 100)
  for (let i = 1; i <= steps; i++) {
    view.pointer('pointermove', 100 + (dx * i) / steps)
    frames(1)
  }
}

test('the arc rests over the sun and under the moon, whichever way it went', () => {
  expect(arcAngle('right', 0, 0)).toBe(180)
  expect(arcAngle('right', 1, 0)).toBe(0)
  expect(arcAngle('right', 0.5, 0)).toBe(90)
  expect(arcAngle('left', 1, 0)).toBe(-0)
  expect(arcAngle('left', 0, 0)).toBe(-180)
  expect(arcAngle('left', 0.5, 0)).toBe(-90)
  // a full turn on the way to 夜海 ends where it began
  expect(arcAngle('right', 0, 1)).toBe(-180)
})

test('the theme does not flicker while the knob hovers at the middle', () => {
  expect(staysDark(true, 0.5)).toBe(true)
  expect(staysDark(true, 0.53)).toBe(true)
  expect(staysDark(true, 0.55)).toBe(false)
  expect(staysDark(false, 0.5)).toBe(false)
  expect(staysDark(false, 0.47)).toBe(false)
  expect(staysDark(false, 0.45)).toBe(true)
})

test('a throw carries the knob past the middle; a slow release does not', () => {
  expect(landing(0.3, 0)).toBe(0)
  expect(landing(0.3, 3)).toBe(1)
  expect(landing(0.7, 0)).toBe(1)
  expect(landing(0.7, -3)).toBe(0)
})

test('the veil is off at the ends and thickest in the middle', () => {
  expect(veilOpacity(0)).toBe(0)
  expect(veilOpacity(1)).toBe(0)
  expect(veilOpacity(0.5)).toBeCloseTo(0.95)
  expect(veilOpacity(0.25)).toBeGreaterThan(0)
  expect(veilOpacity(0.25)).toBeLessThan(0.95)
})

test('past the ends the knob pulls a little and no further', () => {
  expect(rubber(0.4)).toBe(0.4)
  expect(rubber(1.2)).toBeCloseTo(1.05)
  expect(rubber(9)).toBeCloseTo(1.12)
  expect(rubber(-9)).toBeCloseTo(-0.12)
})

test('the theme cycle takes 夜海 only once it was found', () => {
  expect(nextLook('light', true)).toBe('dark')
  expect(nextLook('dark', false)).toBe('light')
  expect(nextLook('dark', true)).toBe('night')
  expect(nextLook('night', true)).toBe('light')
})

test('every pixel of the new icon gets a dot, the same dot each time', () => {
  const from = [
    [0, 0, 1],
    [1, 0, 1],
  ] as const
  const to = [
    [5, 5, 1],
    [6, 5, 1],
    [7, 5, 1],
  ] as const
  const dots = pairDots([...from], [...to], 3)
  expect(
    dots
      .filter((dot) => dot.a1 > 0)
      .map((dot) => dot.x1)
      .sort()
  ).toEqual([5, 6, 7])
  expect(pairDots([...from], [...to], 3)).toEqual(dots)
})

test('a click goes to the other end, shows the theme once, then stops', () => {
  const view = mount('dark')
  view.host.click()
  settle()

  expect(view.x()).toBe(26)
  expect(view.seen).toEqual(['light'])
  expect(view.host.dataset.look).toBe('light')
  expect(view.host.getAttribute('aria-label')).toBe('to dark')
  expect(view.veil()?.style.display).toBe('none')
  expect(queued.size).toBe(0)
})

test('a second click during the move sends the knob back', () => {
  const view = mount('dark')
  view.host.click()
  frames(4)
  view.host.click()
  settle()

  expect(view.x()).toBe(0)
  expect(view.host.dataset.look).toBe('dark')
  // shown only if it had already crossed, and then taken back
  expect(view.seen.length % 2).toBe(0)
})

test('the knob follows the pointer and the page changes past the middle', () => {
  const view = mount('dark')
  dragBy(view, 13)
  expect(view.x()).toBeCloseTo(13, 0)
  expect(view.seen).toEqual([])
  expect(Number(view.veil()?.style.opacity)).toBeGreaterThan(0.9)

  view.pointer('pointermove', 100 + 20)
  frames(2)
  expect(view.seen).toEqual(['light'])
})

test('dragging back over the middle changes the page back', () => {
  const view = mount('dark')
  dragBy(view, 20)
  view.pointer('pointermove', 100 + 4)
  frames(4)
  expect(view.seen).toEqual(['light', 'dark'])

  view.pointer('pointerup', 100 + 4)
  settle()
  expect(view.x()).toBe(0)
  expect(view.host.dataset.look).toBe('dark')
})

test('held still, the knob runs no frames', () => {
  const view = mount('dark')
  dragBy(view, 10)
  frames(40)
  expect(queued.size).toBe(0)

  view.pointer('pointermove', 100 + 11)
  expect(queued.size).toBe(1)
  frames(1)
})

test('the first frame of a drag is not read as a jump', () => {
  const view = mount('dark')
  view.pointer('pointerdown', 100)
  view.pointer('pointermove', 104)
  frames(1)

  const [width] = view.knob.style.scale.split(' ').map(Number)
  expect(width).toBeLessThan(1.1)
})

test('a drag does not also count as a click', () => {
  const view = mount('dark')
  dragBy(view, 26)
  view.pointer('pointerup', 100 + 26)
  view.host.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
  settle()

  expect(view.x()).toBe(26)
  expect(view.seen).toEqual(['light'])
})

test('a click right after a drag whose click never came still works', () => {
  const view = mount('dark')
  dragBy(view, 26)
  view.pointer('pointerup', 100 + 26)
  settle()
  view.pointer('pointerdown', 100)
  view.pointer('pointerup', 100)
  view.host.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
  settle()

  expect(view.x()).toBe(0)
})

test('the keyboard still works right after a drag', () => {
  const view = mount('dark')
  dragBy(view, 26)
  view.pointer('pointerup', 100 + 26)
  settle()
  view.host.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
  settle()

  expect(view.x()).toBe(0)
})

test('when the browser takes the gesture over, the nearer end wins', () => {
  const view = mount('dark')
  dragBy(view, 8, 2)
  view.pointer('pointercancel', 100 + 8)
  settle()

  expect(view.x()).toBe(0)
  expect(view.host.dataset.held).toBeUndefined()
})

test('a right click or a ctrl-click does not grab the knob', () => {
  const view = mount('dark')
  view.pointer('pointerdown', 100, { button: 2 })
  view.pointer('pointermove', 120)
  view.pointer('pointerdown', 100, { ctrlKey: true })
  view.pointer('pointermove', 120)
  frames(2)

  expect(view.x()).toBe(0)
  expect(view.seen).toEqual([])
})

test('a theme changed elsewhere moves the knob with no veil and no echo', () => {
  const view = mount('dark')
  view.themeSwitch.update({
    look: 'light',
    pinned: false,
    nightFound: false,
    labels,
  })
  frames(6)
  expect(view.veil()?.style.display ?? 'none').toBe('none')
  settle()

  expect(view.x()).toBe(26)
  expect(view.seen).toEqual([])
  expect(view.host.dataset.look).toBe('light')
})

test('a page that never changes gets no veil, but its theme still switches', () => {
  const view = mount('dark', { pinned: true })
  dragBy(view, 13)
  expect(view.veil()?.style.display ?? 'none').toBe('none')

  view.pointer('pointermove', 100 + 26)
  frames(2)
  expect(view.seen).toEqual(['light'])
})

test('from dark 夜海 comes next, the knob stays, and then on to light', () => {
  const view = mount('dark', { nightFound: true })
  view.host.click()
  settle()
  expect(view.seen).toEqual(['night'])
  expect(view.x()).toBe(0)
  expect(view.host.dataset.look).toBe('night')

  view.host.click()
  settle()
  expect(view.seen).toEqual(['night', 'light'])
  expect(view.x()).toBe(26)
})

test('dragging from 夜海 to light and back returns to 夜海', () => {
  const view = mount('night', { nightFound: true })
  dragBy(view, 20)
  view.pointer('pointermove', 100 + 2)
  frames(4)

  expect(view.seen).toEqual(['light', 'night'])
})

test('with reduced motion a click lands at once, with no veil', () => {
  setReducedMotion(true)
  const view = mount('dark')
  view.host.click()
  frames(1)

  expect(view.x()).toBe(26)
  expect(view.seen).toEqual(['light'])
  expect(view.veil()?.style.display ?? 'none').toBe('none')
})

test('the theme swap has CSS transitions off for its one frame', () => {
  let during = 0
  const view = mount('dark', {
    onLook: () => {
      during = document.head.querySelectorAll('style').length
    },
  })
  dragBy(view, 26)

  expect(during).toBe(1)
  frames(1)
  expect(document.head.querySelectorAll('style').length).toBe(0)
  expect(view.host.dataset.held).toBe('')
})

test('dispose stops the frames and removes the veil', () => {
  const view = mount('dark')
  view.host.click()
  frames(6)
  expect(view.veil()).not.toBeNull()

  view.themeSwitch.dispose()
  expect(queued.size).toBe(0)
  expect(view.veil()).toBeNull()
  expect(view.host.childElementCount).toBe(0)
})
