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
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { EffortMenu } from '../components/composer/effort-menu'
import { openModelMenu } from '../components/composer/model-menu-bus'
import { DEFAULT_PREFS } from '../constants'

const OURS = ['gpt-6.2-sol', 'gpt-6-luna', 'claude-sonnet-4-6']
const env = vi.hoisted(() => ({ ids: [] as string[] }))
vi.mock('../hooks/use-env', () => ({
  useBearDrawEnv: () => ({
    brainModels: env.ids.map((id) => ({ id, featured: true, price: null })),
  }),
}))

const prefs = () => useBearDrawStore.getState().prefs

beforeEach(() => {
  env.ids = OURS
})

afterEach(() => {
  localStorage.clear()
  useBearDrawStore.setState({ prefs: { ...DEFAULT_PREFS } })
})

describe('the thinking-effort chip', () => {
  test('says the effort, and the slider in its panel changes it', async () => {
    const user = userEvent.setup()
    render(<EffortMenu />)
    const chip = screen.getByRole('button', {
      name: 'Thinking effort: Medium',
    })
    await user.click(chip)

    const slider = screen.getByRole('slider', { name: 'Thinking effort' })
    expect(slider).toHaveAttribute('aria-valuenow', '1')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(prefs().effort).toBe('high')
    fireEvent.keyDown(slider, { key: 'End' })
    expect(prefs().effort).toBe('xhigh')
    expect(slider).toHaveAttribute(
      'aria-valuetext',
      'Extra high, Slower, costs more'
    )
    // the names under the track are a click away, outside the Tab order
    const low = screen.getByRole('button', { name: 'Low' })
    expect(low).toHaveAttribute('tabindex', '-1')
    await user.click(low)
    expect(prefs().effort).toBe('low')
    expect(
      screen.getByRole('button', { name: 'Thinking effort: Low' })
    ).toBeInTheDocument()
  })

  test('the model row lists 最新 and the planners the account has', async () => {
    const user = userEvent.setup()
    render(<EffortMenu />)
    await user.click(
      screen.getByRole('button', { name: 'Thinking effort: Medium' })
    )
    await user.click(screen.getByRole('button', { name: 'Model: Latest' }))

    expect(screen.getByRole('radio', { name: 'Latest' })).toBeChecked()
    // Astra is not open to this account; Claude is not an offered planner
    expect(screen.queryByRole('radio', { name: 'GPT-6.2 Astra' })).toBeNull()
    expect(screen.queryByRole('radio', { name: /claude/ })).toBeNull()

    await user.click(screen.getByRole('radio', { name: 'GPT-6 Luna' }))
    expect(prefs()).toMatchObject({ auto: false, brain: 'gpt-6-luna' })
    // back on the slider, the row names the pick
    expect(
      screen.getByRole('button', { name: 'Model: GPT-6 Luna' })
    ).toBeInTheDocument()
  })

  test('a planner picked before, no longer offered, stays in the list', async () => {
    useBearDrawStore.setState({
      prefs: { ...DEFAULT_PREFS, auto: false, brain: 'claude-sonnet-4-6' },
    })
    const user = userEvent.setup()
    render(<EffortMenu />)
    // Claude takes no thinking effort: the chip names the model, no slider
    await user.click(
      screen.getByRole('button', { name: 'Model: claude-sonnet-4-6' })
    )
    expect(screen.queryByRole('slider')).toBeNull()
    await user.click(
      screen.getAllByRole('button', { name: 'Model: claude-sonnet-4-6' })[1]
    )
    expect(
      screen.getByRole('radio', { name: 'claude-sonnet-4-6' })
    ).toBeChecked()
  })

  test('「换模型」 on an error card opens the list, and the pick runs its step', async () => {
    const user = userEvent.setup()
    const onPicked = vi.fn()
    render(<EffortMenu />)
    openModelMenu({ section: 'brain', onPicked })

    await user.click(await screen.findByRole('radio', { name: 'GPT-6 Luna' }))
    expect(prefs().brain).toBe('gpt-6-luna')
    expect(onPicked).toHaveBeenCalledTimes(1)
  })
})

describe('an account without our planners', () => {
  test('最新 names the model it will use, and the list offers what the account has', async () => {
    env.ids = ['claude-sonnet-4-6', 'some-chat-model']
    const user = userEvent.setup()
    render(<EffortMenu />)
    // no thinking effort to set for this model: the chip names the model
    const chip = screen.getByRole('button', { name: 'Model: Latest' })
    await user.click(chip)
    expect(screen.queryByRole('slider')).toBeNull()
    const row = screen.getAllByRole('button', { name: 'Model: Latest' })[1]
    expect(row).toHaveTextContent('claude-sonnet-4-6')
    await user.click(row)
    expect(screen.getAllByRole('radio').map((x) => x.textContent)).toEqual([
      'Latest',
      'claude-sonnet-4-6',
      'some-chat-model',
    ])
  })
})
