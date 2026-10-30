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

import {
  HANDOFF_KEY,
  LENS_HANDOFF_KEY,
  leaveHandoff,
  leaveLens,
  readLensNote,
} from '../handoff'

const from = 'https://api.example.com/docs/'
const note = (extra: object = {}) =>
  JSON.stringify({
    left: 10,
    right: 70,
    vLeft: 400,
    vRight: 900,
    from,
    at: 1000,
    ...extra,
  })

test('a fresh note from the page this one was opened from is read', () => {
  expect(readLensNote(note(), from, 1500)).toEqual({
    left: 10,
    right: 70,
    vLeft: 400,
    vRight: 900,
  })
})

test('a note from another page, or with no page to come from, is not', () => {
  expect(readLensNote(note(), 'https://api.example.com/pricing', 1500)).toBe(
    null
  )
  expect(readLensNote(note(), '', 1500)).toBe(null)
})

test('a stale note is not read', () => {
  expect(readLensNote(note(), from, 1000 + 3001)).toBe(null)
})

test('a broken note is not read', () => {
  expect(readLensNote('{oops', from, 1500)).toBe(null)
  expect(readLensNote(note({ left: 'x' }), from, 1500)).toBe(null)
  expect(readLensNote(null, from, 1500)).toBe(null)
})

test('the page left is named as the next page sees it: without its #part', () => {
  window.history.replaceState(null, '', '/pricing#faq')
  try {
    leaveHandoff(1)
    leaveLens({ left: 10, right: 70, vLeft: 0, vRight: 0 })
    const page = `${window.location.origin}/pricing`
    for (const key of [HANDOFF_KEY, LENS_HANDOFF_KEY]) {
      const note = JSON.parse(window.sessionStorage.getItem(key) ?? 'null')
      expect(note).toMatchObject({ from: page })
    }
  } finally {
    window.history.replaceState(null, '', '/')
    window.sessionStorage.clear()
  }
})
