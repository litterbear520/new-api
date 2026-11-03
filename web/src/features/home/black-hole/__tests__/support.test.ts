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

describe('a machine with little room', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          getExtension: () => ({ loseContext: () => {} }),
        }) as unknown as WebGL2RenderingContext
    )
  })
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'deviceMemory')
  })

  it('gets the still picture with few cores', async () => {
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(2)
    const { canDrawBlackHole } = await import('../support')
    expect(canDrawBlackHole()).toBe(false)
  })

  it('gets the still picture with little memory', async () => {
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(8)
    Object.defineProperty(navigator, 'deviceMemory', {
      configurable: true,
      value: 2,
    })
    const { canDrawBlackHole } = await import('../support')
    expect(canDrawBlackHole()).toBe(false)
  })

  it('draws the hole with room to spare', async () => {
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(8)
    Object.defineProperty(navigator, 'deviceMemory', {
      configurable: true,
      value: 8,
    })
    const { canDrawBlackHole } = await import('../support')
    expect(canDrawBlackHole()).toBe(true)
  })
})

describe('a screen you touch', () => {
  it('gets the still picture: nothing to follow a pointer, and a battery to spare', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          getExtension: () => ({ loseContext: () => {} }),
        }) as unknown as WebGL2RenderingContext
    )
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(hover: none) and (pointer: coarse)',
          media: query,
        }) as unknown as MediaQueryList
    )
    const { canDrawBlackHole } = await import('../support')
    expect(canDrawBlackHole()).toBe(false)
  })
})

describe('a visitor on a thin line', () => {
  const gl = { getExtension: () => ({ loseContext: () => {} }) }
  const line = (value: object) =>
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value,
    })

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => gl as unknown as WebGL2RenderingContext
    )
  })
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'connection')
  })

  it('gets the still picture when saving data or on 2G', async () => {
    for (const value of [
      { saveData: true },
      { effectiveType: '2g' },
      { effectiveType: 'slow-2g' },
    ]) {
      vi.resetModules()
      line(value)
      const { canDrawBlackHole } = await import('../support')
      expect(canDrawBlackHole()).toBe(false)
    }
  })

  it('keeps the hole on a long line: 3G here only means a far server', async () => {
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(8)
    line({ effectiveType: '3g', saveData: false })
    const { canDrawBlackHole } = await import('../support')
    expect(canDrawBlackHole()).toBe(true)
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
