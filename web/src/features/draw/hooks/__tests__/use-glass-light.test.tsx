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
import { renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { useGlassLight } from '../use-glass'

afterEach(() => vi.unstubAllGlobals())

test('the light starts once a root that mounted late is on the page', () => {
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    frames.push(cb)
  )
  // The page shows a loading state first: no root yet.
  const root: RefObject<HTMLElement | null> = { current: null }
  const { rerender } = renderHook(
    ({ ready }) => useGlassLight(root, '.bc-glass', ready),
    { initialProps: { ready: false } }
  )
  const page = document.createElement('div')
  const glass = document.createElement('div')
  glass.className = 'bc-glass'
  // jsdom lays nothing out; the light needs a size to aim from.
  glass.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 40 }) as DOMRect
  page.append(glass)
  document.body.append(page)
  root.current = page
  rerender({ ready: true })

  window.dispatchEvent(
    Object.assign(new Event('pointermove'), {
      pointerType: 'mouse',
      clientX: 10,
      clientY: 10,
    })
  )
  for (const frame of frames.splice(0)) frame(0)
  expect(glass.style.getPropertyValue('--la')).not.toBe('')
  page.remove()
})
