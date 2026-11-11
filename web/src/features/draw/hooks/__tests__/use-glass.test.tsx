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

import { applyGlass, warmGlass } from '../../lib/glass'
import { useGlass } from '../use-glass'

vi.mock('../../lib/glass', () => ({
  applyGlass: vi.fn(),
  warmGlass: vi.fn(),
  glassSupported: true,
}))

let resized: () => void
let frames: FrameRequestCallback[] = []
let idles: IdleRequestCallback[] = []

beforeEach(() => {
  frames = []
  idles = []
  vi.mocked(applyGlass).mockClear()
  vi.mocked(warmGlass).mockClear()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resized = callback
      }
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    frames.push(callback)
  )
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = []
  })
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) =>
    idles.push(callback)
  )
  vi.stubGlobal('cancelIdleCallback', () => {
    idles = []
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.classList.remove('dark')
})

function mountGlass() {
  const { result } = renderHook(() => useGlass<HTMLDivElement>({}))
  act(() => result.current(document.createElement('div')))
}

test('a theme change refits the lens in the next frame, not in its own', async () => {
  mountGlass()

  await act(async () => {
    document.documentElement.classList.add('dark')
  })

  expect(applyGlass).not.toHaveBeenCalled()
  expect(frames).toHaveLength(1)
  frames[0](0)
  expect(applyGlass).toHaveBeenCalledTimes(1)
})

test('a resize fits at once and bakes the other theme when idle', () => {
  mountGlass()

  resized()

  expect(applyGlass).toHaveBeenCalledTimes(1)
  expect(warmGlass).not.toHaveBeenCalled()
  expect(idles).toHaveLength(1)
  idles[0]({ didTimeout: false, timeRemaining: () => 10 })
  expect(warmGlass).toHaveBeenCalledTimes(1)
})
