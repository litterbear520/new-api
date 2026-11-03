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

type Seen = {
  callback: IntersectionObserverCallback
  options?: IntersectionObserverInit
  disconnect: ReturnType<typeof vi.fn<() => void>>
  target?: Element
}

const observers: Seen[] = []
let sheet: HTMLStyleElement
const reads = vi.fn<() => Element[]>(() => [])

beforeEach(() => {
  observers.length = 0
  reads.mockClear()
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  })
  document.elementsFromPoint = reads
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'elementsFromPoint')
  sheet.remove()
})

function settle() {
  act(() => vi.advanceTimersByTime(2000))
}

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
  // jsdom has no layout: the word has to sit on the glass to be read
  const word = screen.getByRole('button')
  word.getBoundingClientRect = () => new DOMRect(10, 10, 60, 20)
  const glass = slot.querySelector<HTMLElement>('.bd-strip-glass')
  if (!glass) throw new Error('no glass')
  glass.getBoundingClientRect = () => new DOMRect(0, 10, 200, 40)
  return { ...view, box, slot, word }
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
  const { box, slot, word } = renderStrip()
  settle()
  expect(reads).not.toHaveBeenCalled()
  expect(slot).not.toHaveClass('is-stuck')

  pass(observers[0], 20, 48)
  settle()
  expect(slot).toHaveClass('is-stuck')
  expect(reads).toHaveBeenCalled()
  expect(word).toHaveAttribute('data-ink')

  reads.mockClear()
  box.dispatchEvent(new Event('scroll'))
  settle()
  expect(reads).toHaveBeenCalled()

  pass(observers[0], 60, 48)
  expect(slot).not.toHaveClass('is-stuck')
  expect(word).not.toHaveAttribute('data-ink')

  reads.mockClear()
  box.dispatchEvent(new Event('scroll'))
  settle()
  expect(reads).not.toHaveBeenCalled()
})

test('the glass keeps the capsule shape', () => {
  const { container } = renderStrip()
  expect(container.querySelector('.bd-strip-glass')).toHaveClass('rounded-full')
})

test('a new category re-reads the wall under the strip', () => {
  const { word } = renderStrip()
  pass(observers[0], 20, 48)
  settle()
  reads.mockClear()

  act(() => word.click())
  settle()

  expect(reads).toHaveBeenCalled()
})

test('a slot that does not stick (categories on a phone) never gets the glass', () => {
  const { slot } = renderStrip('plain')
  settle()
  expect(observers).toHaveLength(0)
  expect(slot).not.toHaveClass('is-stuck')
  expect(reads).not.toHaveBeenCalled()
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
