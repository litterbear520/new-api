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
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useScrollFade } from '../use-scroll-fade'

/** A 300px wide row of 100px items; the third one is picked. */
function Row(props: { picked: number }) {
  const ref = useScrollFade<HTMLUListElement>('[aria-current="page"]', 4)
  return (
    <ul ref={ref} aria-label='Sections'>
      {[0, 1, 2, 3].map((index) => (
        <li
          key={index}
          data-left={index * 100}
          aria-current={index === props.picked ? 'page' : undefined}
        >
          {`Item ${index}`}
        </li>
      ))}
    </ul>
  )
}

function layOut() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const left = Number((this as HTMLElement).dataset.left ?? 0)
      const width = this.tagName === 'UL' ? 300 : 100
      return DOMRect.fromRect({ x: left, y: 0, width, height: 32 })
    }
  )
}

/** Hands the test the observer the hook creates. */
function fakeObserver() {
  const made: {
    callback?: IntersectionObserverCallback
    targets: Element[]
  } = { targets: [] }
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        made.callback = callback
      }
      observe(target: Element) {
        made.targets.push(target)
      }
      disconnect() {}
    }
  )
  return made
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('scroll fade', () => {
  it('scrolls the row to a picked item that starts out of view on the first render', () => {
    layOut()
    render(<Row picked={3} />)

    // Item 3 spans 300–400px in a 300px row: 100px, plus the 24px fade.
    expect(screen.getByRole('list', { name: 'Sections' }).scrollLeft).toBe(124)
  })

  it('leaves the row where it is when the picked item is already in view', () => {
    layOut()
    render(<Row picked={1} />)

    expect(screen.getByRole('list', { name: 'Sections' }).scrollLeft).toBe(0)
  })

  it('marks the end with more items when the browser has no scroll-driven animations', () => {
    vi.stubGlobal('CSS', { supports: () => false })
    const observer = fakeObserver()
    render(<Row picked={0} />)
    const row = screen.getByRole('list', { name: 'Sections' })
    const [first, last] = observer.targets

    observer.callback?.(
      [
        { target: first, intersectionRatio: 1 },
        { target: last, intersectionRatio: 0.2 },
      ] as unknown as IntersectionObserverEntry[],
      {} as IntersectionObserver
    )

    expect(row).not.toHaveAttribute('data-more-start')
    expect(row).toHaveAttribute('data-more-end')
  })

  it('leaves the fades to CSS when the browser has scroll-driven animations', () => {
    vi.stubGlobal('CSS', { supports: () => true })
    const observer = fakeObserver()
    render(<Row picked={0} />)

    expect(observer.targets).toEqual([])
  })
})
