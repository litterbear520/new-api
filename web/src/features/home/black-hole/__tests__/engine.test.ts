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
import { expect, it, vi } from 'vitest'

import { startBlackHole } from '../engine'

it('starts nothing when the page has already been left: its chunk came too late', () => {
  const canvas = document.createElement('canvas')
  const getContext = vi.spyOn(canvas, 'getContext')
  const raf = vi.spyOn(window, 'requestAnimationFrame')
  const left = new AbortController()
  left.abort()

  const hole = startBlackHole(canvas, { signal: left.signal })

  expect(getContext).not.toHaveBeenCalled()
  expect(raf).not.toHaveBeenCalled()
  expect(() => hole.stop()).not.toThrow()
})
