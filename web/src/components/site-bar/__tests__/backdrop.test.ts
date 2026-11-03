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
import { describe, expect, test } from 'vitest'

import {
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
    expect(tint.outline).toBe(0)
  })

  test('over a light page it turns light, whatever the theme', () => {
    const tint = tintFor(0.9)

    expect(tint.color).toEqual([246, 248, 251])
    expect(tint.alpha).toBeCloseTo(0.16)
    expect(tint.side).toBeCloseTo(0.1)
    expect(tint.outline).toBeCloseTo(0.1)
  })

  test('between the two it moves smoothly', () => {
    const steps = [0.1, 0.2, 0.3, 0.4, 0.5].map((lum) => tintFor(lum).alpha)

    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeLessThanOrEqual(steps[i - 1])
    }
    expect(steps[2]).toBeGreaterThan(0.16)
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

    expect(chooseInk(onEdge, { ink: 'light' }).ink).toBe('light')
    expect(chooseInk([0.16], { ink: 'dark' }).ink).toBe('dark')
  })

  test('scrolling back and forth over the edge does not make it flicker', () => {
    let ink = chooseInk([0.05]).ink
    const seen = new Set([ink])
    for (let i = 0; i < 40; i++) {
      const lum = 0.18 + Math.sin(i) * 0.02
      ink = chooseInk([lum], { ink }).ink
      seen.add(ink)
    }

    expect(seen.size).toBe(1)
  })

  test('it does change once the other colour reads clearly better', () => {
    expect(chooseInk([0.7], { ink: 'light' }).ink).toBe('dark')
    expect(chooseInk([0.02], { ink: 'dark' }).ink).toBe('light')
  })

  test('a word across light and dark gets a plate under it', () => {
    expect(chooseInk([0.02, 0.5]).plate).toBe(true)
  })

  test('a word over one even colour gets no plate', () => {
    expect(chooseInk([0.02, 0.05]).plate).toBe(false)
  })

  test('a spread hovering at the threshold does not flicker the plate', () => {
    expect(chooseInk([0.1, 0.2], { plate: true }).plate).toBe(true)
    expect(chooseInk([0.1, 0.2], { plate: false }).plate).toBe(false)
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

test('white on black has the WCAG contrast of 21', () => {
  expect(contrast(luminance(WHITE), luminance(BLACK))).toBeCloseTo(21)
})

test('half of black over white is the middle grey', () => {
  expect(mix(WHITE, BLACK, 0.5)).toEqual([127.5, 127.5, 127.5])
})
