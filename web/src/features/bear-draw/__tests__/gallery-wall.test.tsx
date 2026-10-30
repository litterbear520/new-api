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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GalleryWall } from '../components/gallery/gallery-wall'
import type { GalleryItem } from '../data/gallery'

const items = Array.from(
  { length: 20 },
  (_, i) =>
    ({
      id: `g${i}`,
      title: `Idea ${i}`,
      category: '写真',
      prompt: 'a prompt',
      cover: `/s/${i}.webp`,
      coverSmall: `/xs/${i}.webp`,
      coverLarge: `/l/${i}.webp`,
      before: null,
      w: 600,
      h: 800,
    }) as unknown as GalleryItem
)

// one observer at a time: the wall watches the marker under its last row
let notify: ((entries: { isIntersecting: boolean }[]) => void) | null = null

class FakeObserver {
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    notify = cb
  }
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
  notify = null
})

const cards = () => screen.getAllByRole('figure')

describe('GalleryWall', () => {
  it('renders two rows first and adds rows as its end nears the screen', () => {
    render(<GalleryWall items={items} onOpen={vi.fn()} onUse={vi.fn()} />)
    // jsdom has no layout: the wall counts 4 columns for its fallback width
    expect(cards()).toHaveLength(8)

    act(() => notify?.([{ isIntersecting: true }]))
    expect(cards()).toHaveLength(16)

    act(() => notify?.([{ isIntersecting: true }]))
    expect(cards()).toHaveLength(20)
  })

  it('loads the top row at once and the rest lazily, at the size the screen needs', () => {
    render(<GalleryWall items={items} onOpen={vi.fn()} onUse={vi.fn()} />)
    const imgs = screen
      .getAllByRole('figure')
      .map((f) => f.querySelector('img') as HTMLImageElement)
    const top = imgs.filter((img) => img.getAttribute('loading') === 'eager')
    expect(top).toHaveLength(4)
    for (const img of top) expect(img).toHaveAttribute('fetchpriority', 'high')
    expect(
      imgs.filter((img) => img.getAttribute('loading') === 'lazy')
    ).toHaveLength(4)
    expect(imgs[0]).toHaveAttribute('srcset', '/xs/0.webp 400w, /s/0.webp 600w')
  })
})
