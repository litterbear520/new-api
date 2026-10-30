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
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Meteors } from '../components/meteor'

// jsdom has no Web Animations: a stand-in that ends when the test says so.
let flights: Array<{ finish: () => void; keyframes: Keyframe[] }> = []
const realAnimate = Element.prototype.animate

beforeEach(() => {
  vi.useFakeTimers()
  flights = []
  Object.defineProperty(document, 'hidden', {
    value: false,
    configurable: true,
  })
  Element.prototype.animate = function (keyframes) {
    const done: Array<() => void> = []
    const anim = {
      addEventListener: (_: string, fn: () => void) => done.push(fn),
      cancel: () => undefined,
      pause: () => undefined,
      updatePlaybackRate: () => undefined,
      finish: () => done.forEach((fn) => fn()),
      keyframes: keyframes as Keyframe[],
    }
    flights.push(anim)
    return anim as unknown as Animation
  }
})

afterEach(() => {
  vi.useRealTimers()
  Element.prototype.animate = realAnimate
})

const meteor = () => screen.queryByRole('button', { name: 'Make a wish' })

function renderMeteors(active = true) {
  const props = { onSighting: vi.fn(), onWish: vi.fn() }
  const view = render(<Meteors active={active} {...props} />)
  return { ...props, ...view }
}

describe('meteors', () => {
  test('come right after the page opens, then one after another', () => {
    const { onSighting } = renderMeteors()
    expect(meteor()).toBeNull()
    act(() => vi.advanceTimersByTime(3000))
    expect(meteor()).toBeInTheDocument()
    expect(onSighting).toHaveBeenLastCalledWith(true)

    act(() => flights[0].finish())
    expect(meteor()).toBeNull()
    act(() => vi.advanceTimersByTime(2400))
    expect(meteor()).toBeInTheDocument()
    // the whole stream is one sighting
    expect(onSighting).not.toHaveBeenCalledWith(false)
  })

  test('rest with nobody around, and come back on the next move', () => {
    const { onSighting } = renderMeteors()
    // each meteor ends, the next comes, until nobody has been around for 80 s
    act(() => vi.advanceTimersByTime(3000))
    for (let s = 3; s < 84; s += 3) {
      act(() => flights.at(-1)?.finish())
      act(() => vi.advanceTimersByTime(3000))
    }
    act(() => flights.at(-1)?.finish())
    act(() => vi.advanceTimersByTime(3000))
    expect(meteor()).toBeNull()
    expect(onSighting).toHaveBeenLastCalledWith(false)
    act(() => vi.advanceTimersByTime(30_000))
    expect(meteor()).toBeNull()
    fireEvent.pointerMove(window)
    act(() => vi.advanceTimersByTime(2400))
    expect(meteor()).toBeInTheDocument()
    expect(onSighting).toHaveBeenLastCalledWith(true)
  })

  test('a caught meteor makes a wish where it was', () => {
    const { onWish } = renderMeteors()
    act(() => vi.advanceTimersByTime(3000))
    fireEvent.click(screen.getByRole('button', { name: 'Make a wish' }))
    expect(screen.getByText(/Wish made/)).toBeInTheDocument()
    expect(onWish).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(450))
    expect(onWish).toHaveBeenCalledTimes(1)
    expect(onWish.mock.calls[0]).toHaveLength(2)
  })

  test('none come under the night sea, and the sighting ends', () => {
    const { onSighting, rerender } = renderMeteors()
    act(() => vi.advanceTimersByTime(3000))
    rerender(
      <Meteors active={false} onSighting={onSighting} onWish={vi.fn()} />
    )
    expect(onSighting).toHaveBeenLastCalledWith(false)
    act(() => flights[0].finish())
    act(() => vi.advanceTimersByTime(10_000))
    expect(meteor()).toBeNull()
  })

  test('stay above the floor the page gives', () => {
    // a moving meteor in a 1200 × 800 page
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) => ({ matches: false, media: query }) as MediaQueryList
    )
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800)
    render(
      <Meteors active floor={() => 150} onSighting={vi.fn()} onWish={vi.fn()} />
    )
    act(() => vi.advanceTimersByTime(3000))
    const button = screen.getByRole('button', { name: 'Make a wish' })
    const top = Number.parseFloat(button.style.top)
    const end = String(flights[0].keyframes.at(-1)?.transform)
    const dy = Number(/translate\([^,]+,\s*([-\d.]+)px\)/.exec(end)?.[1])
    expect(dy).toBeGreaterThan(0)
    expect(top + dy).toBeLessThanOrEqual(150 + 1)
    vi.restoreAllMocks()
  })
})
