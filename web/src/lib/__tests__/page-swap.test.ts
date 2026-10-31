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
import { afterEach, expect, test, vi } from 'vitest'

import { crossFades, inPageSwap } from '../page-swap'

const light = { dark: false, console: false }
const night = { dark: true, console: false }
const consolePage = { dark: false, console: true }

afterEach(() => {
  vi.restoreAllMocks()
})

test('between two light pages outside the console, the screen does not cross-fade', () => {
  expect(crossFades(light, light)).toBe(false)
})

test('between two console pages, the screen does not cross-fade', () => {
  expect(crossFades(consolePage, consolePage)).toBe(false)
})

test('into or out of the console, the screen cross-fades', () => {
  expect(crossFades(light, consolePage)).toBe(true)
  expect(crossFades(consolePage, light)).toBe(true)
})

test('between the night sky and the light pages, the screen cross-fades', () => {
  expect(crossFades(night, light)).toBe(true)
  expect(crossFades(consolePage, night)).toBe(true)
})

test('a page swap is the page cross-fade the browser is running', () => {
  const matches = vi
    .spyOn(document.documentElement, 'matches')
    .mockReturnValue(true)

  expect(inPageSwap()).toBe(true)
  expect(matches).toHaveBeenCalledWith(':active-view-transition-type(page)')
})

test('without a cross-fade running, it is no page swap', () => {
  vi.spyOn(document.documentElement, 'matches').mockReturnValue(false)
  expect(inPageSwap()).toBe(false)
})

test('a browser without view transition types never has a page swap', () => {
  vi.spyOn(document.documentElement, 'matches').mockImplementation(() => {
    throw new SyntaxError('unknown pseudo-class')
  })
  expect(inPageSwap()).toBe(false)
})
