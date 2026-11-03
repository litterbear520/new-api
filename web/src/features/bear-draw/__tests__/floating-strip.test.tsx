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
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { FloatingStrip } from '../components/home/floating-strip'

const ink = vi.hoisted(() => ({
  made: [] as {
    ask: ReturnType<typeof vi.fn>
    newPage: ReturnType<typeof vi.fn>
    hold: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
    parts: { bar: HTMLElement; glass: HTMLElement }
  }[],
}))

vi.mock('@/components/site-bar/bar-ink', () => ({
  BarInk: class {
    ask = vi.fn()
    newPage = vi.fn()
    hold = vi.fn()
    dispose = vi.fn()
    parts: { bar: HTMLElement; glass: HTMLElement }
    constructor(parts: { bar: HTMLElement; glass: HTMLElement }) {
      this.parts = parts
      ink.made.push(this)
    }
  },
}))

type Seen = {
  callback: IntersectionObserverCallback
  options?: IntersectionObserverInit
  disconnect: ReturnType<typeof vi.fn<() => void>>
  target?: Element
}

const observers: Seen[] = []
let sheet: HTMLStyleElement

beforeEach(() => {
  observers.length = 0
  ink.made.length = 0
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      seen: Seen
      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit
      ) {
        this.seen = { callback, options, disconnect: vi.fn<() => void>() }
        observers.push(this.seen)
      }
      observe(target: Element) {
        this.seen.target = target
      }
      disconnect() {
        this.seen.disconnect()
      }
      unobserve() {}
    }
  )
  sheet = document.createElement('style')
  sheet.textContent = '.sticks { position: sticky; top: 48px; }'
  document.head.append(sheet)
})

afterEach(() => {
  vi.unstubAllGlobals()
  sheet.remove()
})

function renderStrip(className = 'sticks') {
  const view = render(
    <div data-slot='console-scroller'>
      <FloatingStrip className={className}>
        <button type='button'>word</button>
      </FloatingStrip>
    </div>
  )
  const box = view.container.querySelector<HTMLElement>(
    '[data-slot="console-scroller"]'
  )
  const slot = view.container.querySelector<HTMLElement>('.bd-strip-slot')
  if (!box || !slot) throw new Error('no strip')
  return { ...view, box, slot }
}

function pass(seen: Seen, top: number, rootTop: number) {
  act(() => {
    seen.callback(
      [
        {
          isIntersecting: top >= rootTop,
          boundingClientRect: { top } as DOMRectReadOnly,
          rootBounds: { top: rootTop } as DOMRectReadOnly,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver
    )
  })
}

test('watches the console scroller, at the line the slot sticks to', () => {
  const { box } = renderStrip()
  expect(observers).toHaveLength(1)
  expect(observers[0].options?.root).toBe(box)
  expect(observers[0].options?.rootMargin).toBe('-48px 0px 0px 0px')
})

test('reads no colours until it is stuck, and stops once it is not', () => {
  const { box, slot } = renderStrip()
  expect(ink.made).toHaveLength(0)
  expect(slot).not.toHaveClass('is-stuck')

  pass(observers[0], 20, 48)
  expect(slot).toHaveClass('is-stuck')
  expect(ink.made).toHaveLength(1)
  const made = ink.made[0]
  expect(made.parts.bar).toContainElement(screen.getByRole('button'))
  expect(made.parts.glass).toHaveClass('rounded-full')
  expect(made.newPage).toHaveBeenCalledTimes(1)

  act(() => {
    box.dispatchEvent(new Event('scroll'))
  })
  expect(made.ask).toHaveBeenCalledTimes(1)

  pass(observers[0], 60, 48)
  expect(slot).not.toHaveClass('is-stuck')
  expect(made.hold).toHaveBeenCalledWith(true)
  expect(made.dispose).toHaveBeenCalled()

  act(() => {
    box.dispatchEvent(new Event('scroll'))
  })
  expect(made.ask).toHaveBeenCalledTimes(1)
})

test('a new category re-reads the wall under the strip', () => {
  renderStrip()
  pass(observers[0], 20, 48)
  const made = ink.made[0]
  made.newPage.mockClear()

  act(() => screen.getByRole('button').click())

  expect(made.newPage).toHaveBeenCalledTimes(1)
})

test('a slot that does not stick (categories on a phone) never gets the glass', () => {
  const { slot } = renderStrip('plain')
  expect(observers).toHaveLength(0)
  expect(slot).not.toHaveClass('is-stuck')
  expect(ink.made).toHaveLength(0)
})

test('turning the phone re-reads the line', () => {
  renderStrip()
  sheet.textContent = '.sticks { position: sticky; top: 50px; }'
  act(() => {
    window.dispatchEvent(new Event('resize'))
  })
  expect(observers[0].disconnect).toHaveBeenCalled()
  expect(observers).toHaveLength(2)
  expect(observers[1].options?.rootMargin).toBe('-50px 0px 0px 0px')
})
