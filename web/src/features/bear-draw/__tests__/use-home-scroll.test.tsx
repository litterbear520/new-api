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
import { render, renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  barHeight,
  pageScroller,
  useScrolledAway,
  useViewStartsAtTop,
} from '../components/home/use-home'

function scene() {
  const box = document.createElement('div')
  box.dataset.slot = 'console-scroller'
  box.style.scrollPaddingTop = '56px'
  const inner = document.createElement('div')
  box.append(inner)
  document.body.append(box)
  return { box, inner }
}

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

test('the page scroller is the console one', () => {
  const { box, inner } = scene()
  expect(pageScroller(inner)).toBe(box)
  expect(pageScroller(document.body)).toBeNull()
  expect(barHeight(box)).toBe(56)
  expect(barHeight(null)).toBe(0)
})

test('a new view starts at the top, a change within one stays put', () => {
  const { box, inner } = scene()
  box.scrollTop = 900
  const view = renderHook(
    ({ name }) => {
      const anchor = useRef<HTMLElement>(inner)
      useViewStartsAtTop(name, anchor)
    },
    { initialProps: { name: 'home' } }
  )
  expect(box.scrollTop).toBe(0)

  box.scrollTop = 900
  view.rerender({ name: 'home' })
  expect(box.scrollTop).toBe(900)

  view.rerender({ name: 'skills' })
  expect(box.scrollTop).toBe(0)

  box.scrollTop = 900
  view.rerender({ name: 'project' })
  expect(box.scrollTop).toBe(0)
})

describe('useScrolledAway', () => {
  const made: {
    callback: IntersectionObserverCallback
    options?: IntersectionObserverInit
  }[] = []

  beforeEach(() => {
    made.length = 0
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(
          callback: IntersectionObserverCallback,
          options?: IntersectionObserverInit
        ) {
          made.push({ callback, options })
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      }
    )
  })

  test('watches the console scroller, below the site bar', () => {
    function Probe() {
      const target = useRef<HTMLDivElement>(null)
      useScrolledAway(target)
      return <div ref={target} />
    }
    const box = document.createElement('div')
    box.dataset.slot = 'console-scroller'
    box.style.scrollPaddingTop = '56px'
    document.body.append(box)
    render(<Probe />, { container: box })

    expect(made).toHaveLength(1)
    expect(made[0].options?.root).toBe(box)
    expect(made[0].options?.rootMargin).toBe('-56px 0px 0px 0px')
  })
})
