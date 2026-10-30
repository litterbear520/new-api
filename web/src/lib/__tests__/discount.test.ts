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
import { describe, expect, it } from 'vitest'

import { formatSharePercent, isDiscounted } from '../discount'

describe('isDiscounted', () => {
  it.each([
    [0.1, 7, true],
    [6.99, 7, true],
    [7, 7, false],
    [8, 7, false],
    [0, 7, false],
    [-1, 7, false],
    [Number.NaN, 7, false],
    [0.1, Number.NaN, false],
  ])('¥%s per dollar at $1 = ¥%s is a deal: %s', (rate, usd, expected) => {
    expect(isDiscounted(rate, usd)).toBe(expected)
  })
})

describe('formatSharePercent', () => {
  it.each([
    [(0.1 / 7) * 100, '1.4%'],
    [(0.05 / 7) * 100, '0.71%'],
    [10, '10%'],
    [14.29, '14.3%'],
    [100, '100%'],
  ])('writes %s as %s, one decimal and two under 1%%', (percent, expected) => {
    expect(formatSharePercent(percent)).toBe(expected)
  })
})
