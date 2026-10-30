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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('whether the black hole can be drawn', () => {
  it('is no without WebGL2, and asks only once', async () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => null)
    const { canDrawBlackHole } = await import('../support')
    expect(canDrawBlackHole()).toBe(false)
    expect(canDrawBlackHole()).toBe(false)
    expect(getContext).toHaveBeenCalledTimes(1)
  })

  it('needs float render targets too, and lets the probe go', async () => {
    const lose = vi.fn()
    const gl = {
      getExtension: (name: string) =>
        name === 'WEBGL_lose_context' ? { loseContext: lose } : null,
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => gl as unknown as WebGL2RenderingContext
    )
    const { canDrawBlackHole } = await import('../support')
    expect(canDrawBlackHole()).toBe(false)
    expect(lose).toHaveBeenCalled()
  })
})

describe('after the first paint', () => {
  it('runs the frame after, once the page has painted', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'setTimeout'] })
    vi.spyOn(performance, 'getEntriesByName').mockReturnValue([
      {} as PerformanceEntry,
    ])
    const { afterFirstPaint } = await import('../support')
    const fn = vi.fn()
    afterFirstPaint(fn)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersToNextFrame()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('waits for the paint, but never long, and can be called off', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'setTimeout'] })
    vi.spyOn(performance, 'getEntriesByName').mockReturnValue([])
    const { afterFirstPaint } = await import('../support')
    const fn = vi.fn()
    afterFirstPaint(fn)
    vi.advanceTimersByTime(100)
    vi.advanceTimersToNextFrame()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    vi.advanceTimersToNextFrame()
    expect(fn).toHaveBeenCalledTimes(1)

    const off = vi.fn()
    afterFirstPaint(off)()
    vi.advanceTimersByTime(2000)
    vi.advanceTimersToNextFrame()
    expect(off).not.toHaveBeenCalled()
  })
})
