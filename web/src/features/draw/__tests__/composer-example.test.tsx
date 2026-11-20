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

import { useDrawStore } from '@/stores/draw-store'

import { Composer } from '../components/composer'

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))

vi.mock('../components/draw-context', () => {
  const ctx = {
    pricing: null,
    groupRatio: 1,
    models: [],
    balanceUsd: 10,
    narrow: false,
    canvasOff: false,
    openCanvas: vi.fn(),
  }
  return { useDrawPage: () => ctx }
})

vi.mock('../components/composer-menus', () => ({
  ModelMenu: () => null,
  PlusMenu: () => null,
  RatioMenu: () => null,
}))

vi.mock('../hooks/use-glass', () => ({ useGlass: () => () => undefined }))

function renderComposer() {
  useDrawStore.getState().reset()
  render(<Composer room={useDrawStore.getState().fresh} />)
  return screen.getByRole<HTMLTextAreaElement>('textbox')
}

const useExample = () => screen.getByRole('button', { name: 'Use example' })

describe('classic draw composer example', () => {
  beforeEach(() => {
    // jsdom has no CSS.supports; the composer asks it about field-sizing.
    vi.stubGlobal('CSS', { supports: () => true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test('Tab in the empty box moves on and leaves the box empty', () => {
    const box = renderComposer()
    const notPrevented = fireEvent.keyDown(box, { key: 'Tab' })
    expect(notPrevented).toBe(true)
    expect(useDrawStore.getState().draft.text).toBe('')
  })

  test('"Use example" fills the box and puts the caret at its end', () => {
    const box = renderComposer()
    fireEvent.click(useExample())
    const text = useDrawStore.getState().draft.text
    expect(text).not.toBe('')
    expect(box).toHaveValue(text)
    expect(box).toHaveFocus()
    expect(box.selectionStart).toBe(text.length)
  })

  test('"Use example" brings the example’s options along', () => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    })
    renderComposer()
    // the fifth grey example asks for a transparent background
    act(() => vi.advanceTimersByTime(4 * 3600))
    fireEvent.click(useExample())
    expect(useDrawStore.getState().draft.clear).toBe(true)
  })

  test('once there is text, "Use example" goes away', () => {
    const box = renderComposer()
    fireEvent.change(box, { target: { value: '一只橘猫' } })
    expect(screen.queryByRole('button', { name: 'Use example' })).toBeNull()
  })
})
