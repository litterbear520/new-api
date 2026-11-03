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
  type Layer,
} from '../backdrop'

const WHITE = [255, 255, 255] as const
const BLACK = [0, 0, 0] as const

describe('chooseInk', () => {
  test('white words on a dark page, black words on a light one', () => {
    expect(chooseInk([0.02, 0.03])).toBe('light')
    expect(chooseInk([0.8, 0.9])).toBe('dark')
  })

  test('over a middling picture a word keeps the colour it has', () => {
    expect(chooseInk([0.2], 'light')).toBe('light')
    expect(chooseInk([0.2], 'dark')).toBe('dark')
  })

  test('pictures of middling brightness passing under never change it', () => {
    let ink = chooseInk([0.05])
    const seen = new Set([ink])
    for (let i = 0; i < 40; i++) {
      ink = chooseInk([0.2 + Math.sin(i) * 0.09], ink)
      seen.add(ink)
    }

    expect(seen.size).toBe(1)
  })

  test('it changes once the word can no longer be read', () => {
    expect(chooseInk([0.4], 'light')).toBe('dark')
    expect(chooseInk([0.05], 'dark')).toBe('light')
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
