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

import { BarInk } from '../bar-ink'

const BLACK_PAGE = 'rgb(0, 0, 0)'
const WHITE_PAGE = 'rgb(255, 255, 255)'

let stackAt: (x: number) => Element[] = () => []
let bar: HTMLElement
let glass: HTMLElement
let word: HTMLElement

const rect = (left: number, width: number, top = 8, height = 40) =>
  ({
    left,
    width,
    right: left + width,
    top,
    height,
    bottom: top + height,
  }) as DOMRect

function page(style: Partial<CSSStyleDeclaration>, attrs: object = {}) {
  const el = document.createElement('div')
  Object.assign(el.style, style)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  document.body.append(el)
  return el
}

function onlyPage(backgroundColor: string) {
  const el = page({ backgroundColor })
  stackAt = () => [el]
}

/** A loaded picture whose thumbnail is one flat `grey`, or unreadable. */
function picture(grey: number | 'other-site') {
  const img = document.createElement('img') as HTMLImageElement & {
    grey: unknown
  }
  img.grey = grey
  Object.defineProperties(img, {
    complete: { value: true },
    naturalWidth: { value: 100 },
    currentSrc: { value: `/picture-${grey}.webp` },
  })
  img.getBoundingClientRect = () => rect(0, 2000, 0, 100)
  return img
}

/** A canvas as browsers have it: another site's picture spoils it for good. */
function fakeCanvases() {
  const drawn: unknown[] = []
  const newContext = () => {
    let spoiled = false
    let grey = 0
    return {
      clearRect() {},
      fillRect() {},
      fillStyle: '',
      drawImage(img: { grey: number | 'other-site' }) {
        drawn.push(img)
        if (img.grey === 'other-site') spoiled = true
        else grey = img.grey
      },
      getImageData(_x: number, _y: number, w: number, h: number) {
        if (spoiled) throw new DOMException('tainted', 'SecurityError')
        const data = new Uint8ClampedArray(w * h * 4).fill(grey)
        for (let i = 3; i < data.length; i += 4) data[i] = 255
        return { data }
      },
    }
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    newContext as never
  )
  return drawn
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  })
  document.elementsFromPoint = (x: number) => stackAt(x)
  bar = document.createElement('header')
  glass = document.createElement('div')
  word = document.createElement('a')
  word.setAttribute('data-site-link', '')
  glass.getBoundingClientRect = () => rect(100, 400)
  word.getBoundingClientRect = () => rect(200, 60)
  bar.append(glass, word)
  document.body.append(bar)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'elementsFromPoint')
  document.body.replaceChildren()
  document.documentElement.classList.remove('dark')
  stackAt = () => []
})

function settled() {
  vi.advanceTimersByTime(1000)
}

function readOnce() {
  const ink = new BarInk({ bar, glass })
  ink.ask()
  settled()
  ink.dispose()
}

test('over a black page the words turn white', () => {
  onlyPage(BLACK_PAGE)

  readOnce()

  expect(word).toHaveAttribute('data-ink', 'light')
})

test('over a black page the glass takes the tint measured on the dark Dock', () => {
  onlyPage(BLACK_PAGE)

  readOnce()

  expect(glass.style.getPropertyValue('--glass-tint')).toContain('52 61 62')
})

test('over a white page the words turn black', () => {
  onlyPage(WHITE_PAGE)

  readOnce()

  expect(word).toHaveAttribute('data-ink', 'dark')
})

test('over a white page the glass takes the light tint', () => {
  onlyPage(WHITE_PAGE)

  readOnce()

  expect(glass.style.getPropertyValue('--glass-tint')).toContain('246 248 251')
})

test('a marked element says how dark it is, as a sky drawn on a canvas must', () => {
  const sky = page({}, { 'data-bar-backdrop': 'dark' })
  const under = page({ backgroundColor: WHITE_PAGE })
  stackAt = () => [sky, under]

  readOnce()

  expect(word).toHaveAttribute('data-ink', 'light')
})

test('a canvas without a mark counts as the theme', () => {
  const canvas = document.createElement('canvas')
  stackAt = () => [canvas]
  document.documentElement.classList.add('dark')

  readOnce()

  expect(word).toHaveAttribute('data-ink', 'light')
})

test('a gradient without a mark counts as the theme, not as what lies under it', () => {
  const gradient = page({ backgroundImage: 'linear-gradient(#000, #111)' })
  const under = page({ backgroundColor: WHITE_PAGE })
  stackAt = () => [gradient, under]
  document.documentElement.classList.add('dark')

  readOnce()

  expect(word).toHaveAttribute('data-ink', 'light')
})

test('the bar itself is never read', () => {
  const onBar = document.createElement('span')
  bar.append(onBar)
  onBar.style.backgroundColor = WHITE_PAGE
  const under = page({ backgroundColor: BLACK_PAGE })
  stackAt = () => [onBar, under]

  readOnce()

  expect(word).toHaveAttribute('data-ink', 'light')
})

test('a control that keeps its own colour takes no ink', () => {
  const avatar = document.createElement('button')
  avatar.setAttribute('data-bar-skip', '')
  avatar.getBoundingClientRect = () => rect(300, 40)
  bar.append(avatar)
  onlyPage(WHITE_PAGE)

  readOnce()

  expect(avatar).not.toHaveAttribute('data-ink')
})

test('a picture under the bar is read from its pixels', () => {
  fakeCanvases()
  const img = picture(10)
  stackAt = () => [img]

  readOnce()

  expect(word).toHaveAttribute('data-ink', 'light')
})

test("another site's picture falls back to its mark", () => {
  fakeCanvases()
  const img = picture('other-site')
  img.setAttribute('data-bar-backdrop', 'dark')
  stackAt = () => [img]

  readOnce()

  expect(word).toHaveAttribute('data-ink', 'light')
})

test("after another site's picture, later pictures can still be read", () => {
  const drawn = fakeCanvases()
  const foreign = picture('other-site')
  const later = picture(250)
  let current: Element = foreign
  stackAt = () => [current]
  const ink = new BarInk({ bar, glass })
  ink.ask()
  settled()

  current = later
  ink.ask()
  settled()
  ink.dispose()

  expect(drawn).toContain(later)
  expect(word).toHaveAttribute('data-ink', 'dark')
})

test('after a fast scroll stops, every picture under the bar has been read', () => {
  const drawn = fakeCanvases()
  const wall = [picture(10), picture(20), picture(30), picture(40), picture(50)]
  stackAt = (x) => [wall[Math.floor((x - 100) / 80)]]

  readOnce()

  expect(new Set(drawn).size).toBe(wall.length)
})

test('after a jump from white to black the tint at rest is fully dark', () => {
  const white = page({ backgroundColor: WHITE_PAGE })
  const black = page({ backgroundColor: BLACK_PAGE })
  let current = white
  stackAt = () => [current]
  const ink = new BarInk({ bar, glass })
  ink.ask()
  settled()

  current = black
  ink.ask()
  settled()
  ink.dispose()

  expect(glass.style.getPropertyValue('--glass-tint')).toContain('52 61 62')
})

test('asked all through a scroll it reads about ten times a second', () => {
  onlyPage(BLACK_PAGE)
  const spy = vi.spyOn(document, 'elementsFromPoint')
  const ink = new BarInk({ bar, glass })
  const reads = () => spy.mock.calls.filter(([x]) => x === 104).length

  for (let i = 0; i < 60; i++) {
    ink.ask()
    vi.advanceTimersByTime(16)
  }
  const during = reads()
  settled()
  ink.dispose()

  expect(during).toBeGreaterThanOrEqual(8)
  expect(during).toBeLessThanOrEqual(11)
})

test('held still it clears what it set', () => {
  onlyPage(WHITE_PAGE)
  const ink = new BarInk({ bar, glass })
  ink.ask()
  settled()

  ink.hold(true)
  ink.dispose()

  expect(word).not.toHaveAttribute('data-ink')
  expect(glass.style.getPropertyValue('--glass-tint')).toBe('')
})

test('held still it reads nothing', () => {
  onlyPage(WHITE_PAGE)
  const ink = new BarInk({ bar, glass })
  ink.hold(true)
  const spy = vi.spyOn(document, 'elementsFromPoint')

  ink.ask()
  settled()
  ink.dispose()

  expect(spy).not.toHaveBeenCalled()
})

test('let go again it reads the page without being asked', () => {
  onlyPage(WHITE_PAGE)
  const ink = new BarInk({ bar, glass })
  ink.hold(true)

  ink.hold(false)
  settled()
  ink.dispose()

  expect(word).toHaveAttribute('data-ink', 'dark')
})

test('where the browser cannot hit-test it leaves the theme colours alone', () => {
  Reflect.deleteProperty(document, 'elementsFromPoint')

  readOnce()

  expect(word).not.toHaveAttribute('data-ink')
})

test('reading at the words, a short word between the bar points still counts', () => {
  const black = page({ backgroundColor: BLACK_PAGE })
  const white = page({ backgroundColor: WHITE_PAGE })
  stackAt = (x) => (x >= 210 && x <= 220 ? [black] : [white])
  word.getBoundingClientRect = () => rect(210, 10)

  const ink = new BarInk({ bar, glass, atWords: true })
  ink.ask()
  settled()
  ink.dispose()

  expect(word).toHaveAttribute('data-ink', 'light')
})

test('a slower strip reads less often while moving', () => {
  onlyPage(WHITE_PAGE)
  const reads = vi.spyOn(document, 'elementsFromPoint')
  const ink = new BarInk({ bar, glass, atWords: true, readGapMs: 200 })
  ink.ask()
  vi.advanceTimersByTime(50)
  const first = reads.mock.calls.length
  expect(first).toBe(2)

  for (let t = 0; t < 15; t++) {
    ink.ask()
    vi.advanceTimersByTime(10)
  }
  expect(reads.mock.calls.length).toBe(first)

  for (let t = 0; t < 5; t++) {
    ink.ask()
    vi.advanceTimersByTime(10)
  }
  expect(reads.mock.calls.length).toBe(first * 2)
  ink.dispose()
})

test('the bar and a strip read each picture only once between them', () => {
  const drawn = fakeCanvases()
  const img = picture(40)
  stackAt = () => [img]

  readOnce()
  const strip = new BarInk({ bar, glass, atWords: true })
  strip.ask()
  settled()
  strip.dispose()

  expect(drawn).toEqual([img])
  expect(word).toHaveAttribute('data-ink', 'light')
})
