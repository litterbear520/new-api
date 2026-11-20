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
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { useThemeColorMeta } from '../use-theme-color-meta'

let frames: FrameRequestCallback[] = []
const flush = () => {
  for (const frame of frames.splice(0)) frame(0)
}

beforeEach(() => {
  document.head.innerHTML =
    '<meta name="theme-color" content="#fff"><meta name="color-scheme" content="light">'
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    frames.push(cb)
  )
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
})

afterEach(() => {
  document.documentElement.classList.remove('dark')
  document.head.innerHTML = ''
  frames = []
  vi.unstubAllGlobals()
})

const scheme = () =>
  document.querySelector("meta[name='color-scheme']")?.getAttribute('content')

test('meta color-scheme follows the theme both ways', async () => {
  document.documentElement.classList.add('dark')
  renderHook(() => useThemeColorMeta())
  flush()
  expect(scheme()).toBe('dark')

  await act(async () => {
    document.documentElement.classList.remove('dark')
  })
  flush()
  expect(scheme()).toBe('light')
})
