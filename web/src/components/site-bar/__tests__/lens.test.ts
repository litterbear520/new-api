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

import { lensAt, nearestLink } from '../lens'

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
