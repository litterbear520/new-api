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
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PlanCard } from '../components/parts/plan-card'
import { decide, fixAdLaw, togglePlanItem } from '../lib/engine'
import type { Part, PlanItem } from '../types'

vi.mock('../lib/engine', () => ({
  decide: vi.fn(),
  fixAdLaw: vi.fn(),
  togglePlanItem: vi.fn(),
}))

type PlanPart = Extract<Part, { type: 'plan' }>

const item = (id: string, label: string, on = true): PlanItem => ({
  id,
  label,
  prompt: `${label} of a navy thermos`,
  ratio: '1:1',
  size: '800×800',
  model: 'gpt-image-2.5-sunburst',
  est: 0.034,
  on,
})

const plan = (patch: Partial<PlanPart> = {}): PlanPart => ({
  id: 'plan1',
  type: 'plan',
  callId: 'call1',
  title: 'Thermos main images',
  items: [
    item('it1', 'Main'),
    item('it2', 'Selling point'),
    item('it3', 'White'),
  ],
  state: 'pending',
  adlaw: [],
  ...patch,
})

describe('PlanCard', () => {
  it('starts all ticked pictures, only the first one, or cancels', async () => {
    const user = userEvent.setup()
    render(<PlanCard projectId='p1' part={plan()} status='waiting' />)

    await user.click(screen.getByRole('button', { name: /^Start drawing 3/ }))
    await user.click(screen.getByRole('button', { name: 'Only the first one' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(vi.mocked(decide).mock.calls).toEqual([
      ['p1', 'plan1', 'start'],
      ['p1', 'plan1', 'first'],
      ['p1', 'plan1', 'cancel'],
    ])
  })

  it('unticks a picture and ticks an unticked one back', async () => {
    const user = userEvent.setup()
    const part = plan({
      items: [item('it1', 'Main'), item('it2', 'Selling point', false)],
    })
    render(<PlanCard projectId='p1' part={part} status='waiting' />)

    await user.click(screen.getByRole('button', { name: 'Do not draw “Main”' }))
    await user.click(
      screen.getByRole('button', { name: 'Draw “Selling point” again' })
    )

    expect(vi.mocked(togglePlanItem).mock.calls).toEqual([
      ['p1', 'plan1', 'it1', false],
      ['p1', 'plan1', 'it2', true],
    ])
  })

  it('replaces the flagged advertising-law words before drawing', async () => {
    const user = userEvent.setup()
    const part = plan({
      adlaw: [{ itemId: 'it2', word: '全网第一', fix: '人气热销' }],
    })
    render(<PlanCard projectId='p1' part={part} status='waiting' />)

    expect(screen.getByText('全网第一')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Replace them all' }))

    expect(fixAdLaw).toHaveBeenCalledWith('p1', 'plan1')
  })

  it('shows a started plan as one quiet line without the buttons', () => {
    render(
      <PlanCard
        projectId='p1'
        part={plan({ state: 'confirmed' })}
        status='running'
      />
    )

    expect(screen.getByText('Started drawing')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Start drawing/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Do not draw/ })).toBeNull()
  })
})
