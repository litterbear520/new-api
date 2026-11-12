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
import { afterEach, expect, it, vi } from 'vitest'

import { startBlackHole } from '../engine'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('a resize while the last one is still baking ends at the final size', async () => {
  vi.useFakeTimers({
    toFake: [
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'setTimeout',
      'clearTimeout',
      'performance',
    ],
  })
  let resize = () => {}
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    'Image',
    class {
      src = ''
      decode() {
        return Promise.resolve()
      }
    }
  )
  vi.stubGlobal('devicePixelRatio', 1)
  // Only the browser and GPU edges are stubbed: scheduling, baking and size
  // picking run as they are. This checks sizes, not pixels.
  const constants = new Map<PropertyKey, number>()
  const gl = new Proxy(
    {},
    {
      get(_target, key) {
        if (key === 'getExtension') {
          return (name: string) =>
            name === 'EXT_color_buffer_float' ? {} : null
        }
        if (key === 'getProgramParameter') return () => true
        if (/^[A-Z_0-9]+$/.test(String(key))) {
          if (!constants.has(key)) constants.set(key, constants.size + 1)
          return constants.get(key)
        }
        if (String(key).startsWith('create') || key === 'getUniformLocation') {
          return () => ({})
        }
        return () => {}
      },
    }
  )
  const canvas = document.createElement('canvas')
  let width = 1200
  vi.spyOn(canvas, 'getContext').mockReturnValue(
    gl as unknown as WebGL2RenderingContext
  )
  vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() => ({
    width,
    height: 700,
    left: 0,
    top: 0,
    right: width,
    bottom: 700,
    x: 0,
    y: 0,
    toJSON() {
      return {}
    },
  }))
  const failed = vi.fn()
  const left = new AbortController()
  const hole = startBlackHole(canvas, { signal: left.signal, onFail: failed })
  try {
    await vi.advanceTimersByTimeAsync(2500)
    expect(failed).not.toHaveBeenCalled()
    expect(canvas.dataset.ready).toBe('1')
    expect(canvas.width).toBe(1200)

    width = 1000
    resize()
    await vi.advanceTimersByTimeAsync(240)
    // that size is baking now (24 strips and the Earth, one a frame)
    width = 800
    resize()
    await vi.advanceTimersByTimeAsync(4000)
    expect(failed).not.toHaveBeenCalled()
    expect(canvas.width).toBe(800)
  } finally {
    hole.stop()
  }
})
