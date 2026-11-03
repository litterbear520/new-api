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

import {
  BarInk,
  chooseInk,
  composite,
  contrast,
  luminance,
  mix,
  tintFor,
  type Layer,
} from '../backdrop'

const WHITE = [255, 255, 255] as const
const BLACK = [0, 0, 0] as const

describe('tintFor', () => {
  test('over a dark page it is the tint measured on the Dock', () => {
    const tint = tintFor(0.02)

    expect(tint.color).toEqual([52, 61, 62])
    expect(tint.alpha).toBeCloseTo(0.29)
    expect(tint.side).toBeCloseTo(0.45)
    expect(tint.edge).toBeCloseTo(0.24)
  })

  test('over a light page it turns light, whatever the theme', () => {
    const tint = tintFor(0.9)

    expect(tint.color).toEqual([153, 153, 153])
    expect(tint.alpha).toBeCloseTo(0.25)
    expect(tint.side).toBeCloseTo(0.18)
    expect(tint.edge).toBeCloseTo(0.73)
  })

  test('between the two it moves smoothly', () => {
    const steps = [0.1, 0.2, 0.3, 0.4, 0.5].map((lum) => tintFor(lum).alpha)

    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeLessThanOrEqual(steps[i - 1])
    }
    expect(steps[2]).toBeGreaterThan(0.25)
    expect(steps[2]).toBeLessThan(0.29)
  })
})

describe('chooseInk', () => {
  test('white words on a dark page, black words on a light one', () => {
    expect(chooseInk([0.02, 0.03]).ink).toBe('light')
    expect(chooseInk([0.8, 0.9]).ink).toBe('dark')
  })

  test('around the point where both read alike, a word keeps its colour', () => {
    // white and black read equally at a luminance of about 0.18
    const onEdge = [0.2]
    expect(chooseInk(onEdge).ink).toBe('dark')

    expect(chooseInk(onEdge, 'light').ink).toBe('light')
    expect(chooseInk([0.16], 'dark').ink).toBe('dark')
  })

  test('scrolling back and forth over the edge does not make it flicker', () => {
    let ink = chooseInk([0.05]).ink
    const seen = new Set([ink])
    for (let i = 0; i < 40; i++) {
      const lum = 0.18 + Math.sin(i) * 0.02
      ink = chooseInk([lum], ink).ink
      seen.add(ink)
    }

    expect(seen.size).toBe(1)
  })

  test('it does change once the other colour reads clearly better', () => {
    expect(chooseInk([0.7], 'light').ink).toBe('dark')
    expect(chooseInk([0.02], 'dark').ink).toBe('light')
  })

  test('a word across light and dark gets a plate under it', () => {
    expect(chooseInk([0.02, 0.5]).plate).toBe(true)
    expect(chooseInk([0.02, 0.05]).plate).toBe(false)
  })
})

describe('composite', () => {
  const layer = (
    color: readonly [number, number, number],
    alpha = 1
  ): Layer => ({
    color,
    alpha,
  })

  test('the top opaque layer wins', () => {
    expect(composite([layer(BLACK), layer(WHITE)], WHITE)).toEqual([0, 0, 0])
  })

  test('a see-through layer lets the one under it show', () => {
    expect(composite([layer(BLACK, 0.5), layer(WHITE)], WHITE)).toEqual([
      127.5, 127.5, 127.5,
    ])
  })

  test('with nothing to read it falls back', () => {
    expect(composite([], [20, 20, 24])).toEqual([20, 20, 24])
    expect(composite([layer(BLACK, 0.5)], WHITE)).toEqual([127.5, 127.5, 127.5])
  })
})

test('contrast and mix follow WCAG', () => {
  expect(contrast(luminance(WHITE), luminance(BLACK))).toBeCloseTo(21)
  expect(mix(WHITE, BLACK, 0.5)).toEqual([127.5, 127.5, 127.5])
})

describe('BarInk', () => {
  let stack: Element[] = []
  let bar: HTMLElement
  let glass: HTMLElement
  let word: HTMLElement

  const rect = (left: number, width: number) =>
    ({
      left,
      width,
      right: left + width,
      top: 8,
      height: 40,
      bottom: 48,
    }) as DOMRect

  function page(style: Partial<CSSStyleDeclaration>, attrs: object = {}) {
    const el = document.createElement('div')
    Object.assign(el.style, style)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
    document.body.append(el)
    return el
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
    document.elementsFromPoint = () => stack
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
    document.body.replaceChildren()
    document.documentElement.classList.remove('dark')
    stack = []
  })

  function settled() {
    vi.advanceTimersByTime(1000)
  }

  test('over a black page the words turn white and the glass takes the dark tint', () => {
    stack = [page({ backgroundColor: 'rgb(0, 0, 0)' })]
    const ink = new BarInk({ bar, glass })

    ink.ask()
    settled()

    expect(word).toHaveAttribute('data-ink', 'light')
    expect(glass.style.getPropertyValue('--glass-tint')).toContain('52 61 62')
    ink.dispose()
  })

  test('over a white page the words turn black and the glass takes the light tint', () => {
    stack = [page({ backgroundColor: 'rgb(255, 255, 255)' })]
    const ink = new BarInk({ bar, glass })

    ink.ask()
    settled()

    expect(word).toHaveAttribute('data-ink', 'dark')
    expect(glass.style.getPropertyValue('--glass-tint')).toContain(
      '153 153 153'
    )
    ink.dispose()
  })

  test('a marked element says how dark it is, as a sky drawn on a canvas must', () => {
    stack = [
      page({}, { 'data-bar-backdrop': 'dark' }),
      page({ backgroundColor: 'rgb(255, 255, 255)' }),
    ]
    const ink = new BarInk({ bar, glass })

    ink.ask()
    settled()

    expect(word).toHaveAttribute('data-ink', 'light')
    ink.dispose()
  })

  test('what cannot be read falls back to the theme', () => {
    stack = [document.createElement('canvas')]
    document.documentElement.classList.add('dark')
    const ink = new BarInk({ bar, glass })

    ink.ask()
    settled()

    expect(word).toHaveAttribute('data-ink', 'light')
    ink.dispose()
  })

  test('the bar itself is never read', () => {
    const onBar = document.createElement('span')
    bar.append(onBar)
    onBar.style.backgroundColor = 'rgb(255, 255, 255)'
    stack = [onBar, page({ backgroundColor: 'rgb(0, 0, 0)' })]
    const ink = new BarInk({ bar, glass })

    ink.ask()
    settled()

    expect(word).toHaveAttribute('data-ink', 'light')
    ink.dispose()
  })

  test('a scroll asks many times but it reads about ten times a second', () => {
    stack = [page({ backgroundColor: 'rgb(0, 0, 0)' })]
    const spy = vi.spyOn(document, 'elementsFromPoint')
    const ink = new BarInk({ bar, glass })
    const passes = () => spy.mock.calls.filter(([x]) => x === 104).length

    for (let i = 0; i < 60; i++) {
      ink.ask()
      vi.advanceTimersByTime(16)
    }

    expect(passes()).toBeGreaterThanOrEqual(8)
    expect(passes()).toBeLessThanOrEqual(11)
    settled()
    ink.dispose()
  })

  test('held still (the night-sea pages) it clears what it set and reads nothing', () => {
    stack = [page({ backgroundColor: 'rgb(255, 255, 255)' })]
    const ink = new BarInk({ bar, glass })
    ink.ask()
    settled()

    ink.hold(true)
    const spy = vi.spyOn(document, 'elementsFromPoint')
    ink.ask()
    settled()

    expect(word).not.toHaveAttribute('data-ink')
    expect(glass.style.getPropertyValue('--glass-tint')).toBe('')
    expect(spy).not.toHaveBeenCalled()
    ink.dispose()
  })

  test('where the browser cannot hit-test it leaves the theme colours alone', () => {
    // @ts-expect-error jsdom has none, nor would a very old browser
    document.elementsFromPoint = undefined
    const ink = new BarInk({ bar, glass })

    ink.ask()
    settled()

    expect(word).not.toHaveAttribute('data-ink')
    ink.dispose()
  })
})
