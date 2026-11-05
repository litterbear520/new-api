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
import { expect, test } from 'vitest'

import { keepInside, lensAt, nearestLink } from '../lens'

// three links: 60px, 100px and 60px wide, 10px apart
const spans = [
  { left: 0, right: 60 },
  { left: 70, right: 170 },
  { left: 180, right: 240 },
]

test('the dragged lens is centred on the finger', () => {
  const lens = lensAt(spans, 120)
  expect((lens.left + lens.right) / 2).toBe(120)
})

test('over a link the lens is as wide as that link', () => {
  const lens = lensAt(spans, 120)
  expect(lens.right - lens.left).toBe(100)
})

test('between two links the lens takes a width between theirs', () => {
  // halfway from the first link's middle (30) to the second's (120)
  const lens = lensAt(spans, 75)
  expect(lens.right - lens.left).toBe(80)
})

test('past the last link the lens follows the finger only part of the way', () => {
  const lens = lensAt(spans, 310)
  const middle = (lens.left + lens.right) / 2
  expect(middle).toBeGreaterThan(210)
  expect(middle).toBeLessThan(310)
  expect(lens.right - lens.left).toBe(60)
})

test('letting go picks the link whose middle is nearest', () => {
  expect(nearestLink(spans, 70)).toBe(0)
  expect(nearestLink(spans, 80)).toBe(1)
  expect(nearestLink(spans, 400)).toBe(2)
  expect(nearestLink(spans, -50)).toBe(0)
})

test('however far past the ends it is pulled, the lens moves only a little further', () => {
  const near = (lensAt(spans, 215).left + lensAt(spans, 215).right) / 2
  const far = lensAt(spans, 50_000)
  const farMiddle = (far.left + far.right) / 2
  expect(near).toBeGreaterThan(210)
  expect(farMiddle).toBeGreaterThan(near)
  expect(farMiddle).toBeLessThanOrEqual(222)
  const left = lensAt(spans, -50_000)
  expect((left.left + left.right) / 2).toBeGreaterThanOrEqual(18)
})

test('the pull grows with the finger and never jumps at the end', () => {
  let before = (lensAt(spans, 210).left + lensAt(spans, 210).right) / 2
  for (let x = 211; x < 1000; x++) {
    const lens = lensAt(spans, x)
    const middle = (lens.left + lens.right) / 2
    expect(middle).toBeGreaterThan(before)
    expect(middle - before).toBeLessThanOrEqual(0.56)
    before = middle
  }
})

test('swollen, the lens at the first and last links stays inside the bar', () => {
  const bounds = { left: -2, right: 300 }
  for (const x of [-50_000, -5, 0, 30, 120, 210, 300, 50_000]) {
    const lens = lensAt(spans, x, bounds, 1.2)
    const half = ((lens.right - lens.left) / 2) * 1.2
    const middle = (lens.left + lens.right) / 2
    expect(middle - half).toBeGreaterThanOrEqual(bounds.left - 1e-9)
    expect(middle + half).toBeLessThanOrEqual(bounds.right + 1e-9)
  }
})

test('kept inside, a span too wide is narrowed and one too far is moved', () => {
  const bounds = { left: 0, right: 100 }
  expect(keepInside({ left: 20, right: 40 }, bounds, 1)).toEqual({
    left: 20,
    right: 40,
  })
  expect(keepInside({ left: 90, right: 130 }, bounds, 1)).toEqual({
    left: 60,
    right: 100,
  })
  expect(keepInside({ left: -50, right: 200 }, bounds, 2)).toEqual({
    left: 25,
    right: 75,
  })
})
