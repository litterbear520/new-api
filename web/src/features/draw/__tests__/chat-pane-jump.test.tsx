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
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { ChatPane } from '../components/chat-pane'
import type { DrawRoom } from '../types'

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))

vi.mock('../components/draw-context', () => {
  const ctx = {
    balanceUsd: null,
    narrow: false,
    canvasOff: false,
    setCanvasOn: vi.fn(),
  }
  return { useDrawPage: () => ctx }
})

vi.mock('../hooks/use-glass', () => ({ useGlass: () => () => undefined }))

// the pane's own parts; each has its own tests
vi.mock('../components/composer', () => ({
  Composer: () => <textarea aria-label='Describe' />,
}))
vi.mock('../components/room-switcher', () => ({ RoomSwitcher: () => null }))
vi.mock('../components/messages', () => ({
  ResultMessage: () => null,
  UserMessage: () => null,
}))

const room: DrawRoom = { id: 'r1', title: 'Cats', model: 'm', t: 1, msgs: [] }

const jump = () =>
  screen.getByRole('button', { name: 'Back to the newest', hidden: true })

/** Scrolls the conversation to `fromEnd` pixels above its end. */
function scrollTo(fromEnd: number) {
  const el = document.querySelector<HTMLElement>('.dw-cp-scroll')
  if (!el) throw new Error('no scroller')
  Object.defineProperty(el, 'scrollHeight', { value: 2000, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true })
  el.scrollTop = 1500 - fromEnd
  fireEvent.scroll(el)
}

describe('classic draw "Back to the newest"', () => {
  // jsdom has no scrolling
  const realScrollTo = HTMLElement.prototype.scrollTo
  beforeEach(() => {
    HTMLElement.prototype.scrollTo = () => undefined
  })
  afterEach(() => {
    HTMLElement.prototype.scrollTo = realScrollTo
  })

  test('at the newest message it is out of Tab and screen readers', () => {
    render(<ChatPane room={room} />)
    expect(jump()).toHaveAttribute('inert')
  })

  test('scrolled up, it can be reached', () => {
    render(<ChatPane room={room} />)
    scrollTo(600)
    expect(jump()).not.toHaveAttribute('inert')
  })

  test('used from the keyboard, it hands the focus to the message box', () => {
    render(<ChatPane room={room} />)
    scrollTo(600)
    fireEvent.click(jump(), { detail: 0 })
    expect(screen.getByRole('textbox')).toHaveFocus()
  })
})
