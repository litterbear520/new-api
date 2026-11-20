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
import { paceFrame } from '../scene'

vi.mock('../scene', async (importOriginal) => {
  const real = await importOriginal<typeof import('../scene')>()
  return { ...real, paceFrame: vi.fn(real.paceFrame) }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.mocked(paceFrame).mockClear()
})

const FRAME = 1000 / 60

/**
 * The engine with only the browser and GPU edges stubbed. Frames run when the
 * test says so; a frame nobody asked for never comes, as in a real browser.
 */
function startHole() {
  const pending = new Map<number, FrameRequestCallback>()
  let nextId = 1
  let clock = 0
  const requested = vi.fn((callback: FrameRequestCallback) => {
    pending.set(nextId, callback)
    return nextId++
  })
  vi.stubGlobal('requestAnimationFrame', requested)
  vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id))
  let seen: (entries: { isIntersecting: boolean }[]) => void = () => {}
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: typeof seen) {
        seen = callback
      }
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    'ResizeObserver',
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
  let hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
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
  vi.spyOn(canvas, 'getContext').mockReturnValue(
    gl as unknown as WebGL2RenderingContext
  )
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1200, 700)
  )
  const drawn = vi.fn()
  const failed = vi.fn()
  const left = new AbortController()
  const hole = startBlackHole(canvas, {
    signal: left.signal,
    onFrame: drawn,
    onFail: failed,
  })

  async function frames(count = 1) {
    for (let i = 0; i < count; i++) {
      clock += FRAME
      const due = [...pending.values()]
      pending.clear()
      for (const callback of due) callback(clock)
      // the textures' decode() settles between frames
      for (let j = 0; j < 4; j++) await Promise.resolve()
    }
  }
  async function untilReady() {
    for (let i = 0; i < 600 && canvas.dataset.ready !== '1'; i++) {
      await frames()
    }
    expect(failed).not.toHaveBeenCalled()
    expect(canvas.dataset.ready).toBe('1')
    // a few drawn frames, so the pace has gaps to look at
    await frames(10)
  }
  return {
    hole,
    drawn,
    requested,
    frames,
    untilReady,
    /** loops waiting for their next frame */
    waiting: () => pending.size,
    /** time passes with no frame run (nothing is waiting, or the tab is away) */
    pause: (ms: number) => {
      clock += ms
    },
    scroll: (isIntersecting: boolean) => seen([{ isIntersecting }]),
    tab: (isHidden: boolean) => {
      hidden = isHidden
      document.dispatchEvent(new Event('visibilitychange'))
    },
  }
}

it('asks for no frames while the hole is scrolled off screen, and starts again when it is back', async () => {
  const h = startHole()
  try {
    await h.untilReady()
    h.scroll(false)
    await h.frames()
    expect(h.waiting()).toBe(0)
    const asked = h.requested.mock.calls.length
    await h.frames(60)
    expect(h.requested).toHaveBeenCalledTimes(asked)

    h.scroll(true)
    expect(h.waiting()).toBe(1)
    const before = h.drawn.mock.calls.length
    await h.frames(3)
    expect(h.drawn.mock.calls.length).toBeGreaterThan(before)
  } finally {
    h.hole.stop()
  }
})

it('stops the same way in a hidden tab and starts again when the tab shows', async () => {
  const h = startHole()
  try {
    await h.untilReady()
    h.tab(true)
    await h.frames()
    expect(h.waiting()).toBe(0)

    h.tab(false)
    expect(h.waiting()).toBe(1)
    const before = h.drawn.mock.calls.length
    await h.frames(3)
    expect(h.drawn.mock.calls.length).toBeGreaterThan(before)
  } finally {
    h.hole.stop()
  }
})

it('keeps one loop when it is woken twice, or woken while it still runs', async () => {
  const h = startHole()
  try {
    await h.untilReady()
    h.scroll(true)
    h.tab(false)
    expect(h.waiting()).toBe(1)

    h.scroll(false)
    await h.frames()
    h.scroll(true)
    h.scroll(true)
    h.tab(false)
    expect(h.waiting()).toBe(1)
    for (let i = 0; i < 30; i++) {
      await h.frames()
      expect(h.waiting()).toBe(1)
    }
  } finally {
    h.hole.stop()
  }
})

it('does not count the time away as a late frame', async () => {
  const h = startHole()
  try {
    await h.untilReady()
    h.scroll(false)
    await h.frames()
    h.pause(5000)
    vi.mocked(paceFrame).mockClear()
    const before = h.drawn.mock.calls.length

    h.scroll(true)
    await h.frames()
    // drawn at once, not held back as if a frame had just been drawn
    expect(h.drawn).toHaveBeenCalledTimes(before + 1)
    await h.frames(30)
    const gaps = vi.mocked(paceFrame).mock.calls.map((call) => call[1])
    expect(gaps.length).toBeGreaterThan(0)
    expect(Math.max(...gaps)).toBeLessThan(2 * FRAME)
  } finally {
    h.hole.stop()
  }
})

it('starts nothing once stopped, whatever the page does after', async () => {
  const h = startHole()
  await h.untilReady()
  h.scroll(false)
  await h.frames()
  h.hole.stop()
  h.scroll(true)
  h.tab(false)
  expect(h.waiting()).toBe(0)
})
