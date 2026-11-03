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

import { whenBelowFoldWanted } from '../below-fold'

const navigationType = (type: string) =>
  vi
    .spyOn(performance, 'getEntriesByType')
    .mockReturnValue([{ type } as unknown as PerformanceEntry])

const setScroll = (y: number) =>
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y })

beforeEach(() => {
  vi.useFakeTimers()
  navigationType('navigate')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  setScroll(0)
  window.history.replaceState(null, '', '/')
  Reflect.deleteProperty(navigator, 'connection')
})

describe('what lies under the first screen', () => {
  it('waits while the page loads and the visitor looks at the first screen', () => {
    const fn = vi.fn()
    whenBelowFoldWanted(fn)
    expect(fn).not.toHaveBeenCalled()
  })

  it('comes as soon as the visitor goes to scroll', () => {
    for (const type of ['scroll', 'wheel', 'touchmove', 'keydown']) {
      const fn = vi.fn()
      whenBelowFoldWanted(fn)
      window.dispatchEvent(new Event(type))
      expect(fn).toHaveBeenCalledTimes(1)
      window.dispatchEvent(new Event(type))
      expect(fn).toHaveBeenCalledTimes(1)
    }
  })

  it('comes by itself once the page has loaded and the browser is idle', () => {
    const fn = vi.fn()
    whenBelowFoldWanted(fn)
    vi.advanceTimersByTime(10_000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('comes at once to a page already scrolled, or asked for by a hash', () => {
    setScroll(300)
    const scrolled = vi.fn()
    whenBelowFoldWanted(scrolled)
    expect(scrolled).toHaveBeenCalledTimes(1)
    setScroll(0)

    window.history.replaceState(null, '', '/#ns-more')
    const hashed = vi.fn()
    whenBelowFoldWanted(hashed)
    expect(hashed).toHaveBeenCalledTimes(1)
  })

  it('comes at once on a reload or going back: the browser puts the scroll back', () => {
    for (const type of ['reload', 'back_forward']) {
      navigationType(type)
      const fn = vi.fn()
      whenBelowFoldWanted(fn)
      expect(fn).toHaveBeenCalledTimes(1)
    }
  })

  it('waits for the scroll when the visitor saves data', () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true },
    })
    const fn = vi.fn()
    whenBelowFoldWanted(fn)
    vi.advanceTimersByTime(60_000)
    expect(fn).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('scroll'))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('can be called off', () => {
    const fn = vi.fn()
    whenBelowFoldWanted(fn)()
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(10_000)
    expect(fn).not.toHaveBeenCalled()
  })
})
