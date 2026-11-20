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
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { Composer } from '../components/composer/composer'
import { DEFAULT_PREFS } from '../constants'

vi.mock('../lib/engine', () => ({
  storeAttachments: vi.fn(async () => []),
  estimatePicture: vi.fn(() => 0.03),
  isBusy: vi.fn(() => false),
}))

vi.mock('../hooks/use-env', () => {
  const env = {
    uid: 1,
    imageModels: [],
    brainModels: [],
    prices: new Map(),
    groupRatio: 1,
    balanceUsd: 10,
    loading: false,
    failed: false,
  }
  return { useBearDrawEnv: () => env }
})

/** The first example on the home page and the skill that goes with it. */
const FIRST = 'Make a set of Taobao main pictures for my insulated bottle'

function setup(variant: 'home' | 'dock' = 'home') {
  render(<Composer variant={variant} onSend={vi.fn()} />)
  const box = screen.getByRole('textbox', {
    name: 'Describe what you want to design',
  })
  return { box, user: userEvent.setup() }
}

beforeEach(() => {
  useBearDrawStore.setState({
    prefs: { ...DEFAULT_PREFS },
    brandKit: null,
    mySkills: [],
    live: {},
    projects: [],
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('「使用示例」 on the home composer', () => {
  it('Tab in the empty box moves on to the button and leaves the box empty', async () => {
    const { box, user } = setup()
    box.focus()
    await user.tab()
    expect(box).toHaveValue('')
    const use = screen.getByRole('button', { name: 'Use example' })
    expect(document.activeElement).toBe(use)
    expect(use).toHaveAccessibleDescription(expect.stringContaining(FIRST))
  })

  it('a click fills in the example and its skill, back in the box with the caret at the end', async () => {
    const { box, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Use example' }))
    expect(box).toHaveValue(FIRST)
    expect(document.activeElement).toBe(box)
    expect((box as HTMLTextAreaElement).selectionStart).toBe(FIRST.length)
    expect((box as HTMLTextAreaElement).selectionEnd).toBe(FIRST.length)
    expect(screen.queryByRole('button', { name: 'Use example' })).toBeNull()
    // the example's skill comes with it
    expect(
      screen.getByRole('button', { name: 'Remove this skill' })
    ).toBeTruthy()
  })

  it('Enter on the focused button fills in the example too', async () => {
    const { box, user } = setup()
    screen.getByRole('button', { name: 'Use example' }).focus()
    await user.keyboard('{Enter}')
    expect(box).toHaveValue(FIRST)
    expect(document.activeElement).toBe(box)
  })

  it('keeps the same example while the button has the focus', () => {
    vi.useFakeTimers()
    setup()
    const use = screen.getByRole('button', { name: 'Use example' })
    act(() => use.focus())
    // several rotation periods (4.2 s each) go by
    act(() => vi.advanceTimersByTime(20_000))
    expect(use).toHaveAccessibleDescription(expect.stringContaining(FIRST))
  })

  it('is not offered once the box has text', async () => {
    const { box, user } = setup()
    await user.type(box, 'a')
    expect(screen.queryByRole('button', { name: 'Use example' })).toBeNull()
  })

  it('is not offered in the composer docked in a project', () => {
    setup('dock')
    expect(screen.queryByRole('button', { name: 'Use example' })).toBeNull()
  })
})
