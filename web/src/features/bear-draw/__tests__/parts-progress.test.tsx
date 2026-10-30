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

import {
  PartActionsContext,
  type PartActions,
} from '../components/parts/part-actions'
import { ProgressGrid } from '../components/parts/progress-grid'
import { retryPicture } from '../lib/engine'
import type { Part, PictureJob, ProgressItem } from '../types'

vi.mock('../lib/engine', () => ({ retryPicture: vi.fn() }))

type ProgressPart = Extract<Part, { type: 'progress' }>

const job: PictureJob = {
  model: 'gpt-image-2.5-sunburst',
  prompt: 'A navy thermos on a wooden table',
  transparent: false,
  inputs: [],
  ratio: '1:1',
}

const picture = (patch: Partial<ProgressItem>): ProgressItem => ({
  id: 'it1',
  nodeId: 'n1',
  label: 'Main',
  size: '800×800',
  model: 'gpt-image-2.5-sunburst',
  prompt: 'A navy thermos on a wooden table',
  status: 'queued',
  ...patch,
})

const grid = (items: ProgressItem[]): ProgressPart => ({
  id: 'pr1',
  type: 'progress',
  groupId: 'g1',
  items,
})

describe('ProgressGrid', () => {
  it('offers 重试 on a failed picture and draws it again', async () => {
    const user = userEvent.setup()
    const failed = picture({ status: 'failed', error: { kind: 'busy' }, job })
    render(<ProgressGrid projectId='p1' part={grid([failed])} />)

    expect(
      screen.getByText('The server is busy; this picture was not drawn')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry “Main”' }))

    expect(retryPicture).toHaveBeenCalledWith('p1', 'n1')
  })

  it('has no 重试 when the request behind a failed picture is unknown', () => {
    const failed = picture({ status: 'failed', error: { kind: 'other' } })
    render(<ProgressGrid projectId='p1' part={grid([failed])} />)

    expect(screen.queryByRole('button', { name: /^Retry/ })).toBeNull()
  })

  it('opens the canvas at the picture when a waiting tile is clicked', async () => {
    const user = userEvent.setup()
    const openCanvas = vi.fn()
    const actions: PartActions = {
      balanceUsd: null,
      busy: true,
      openCanvas,
      exportGroup: vi.fn(),
      setComposerText: vi.fn(),
      focusComposer: vi.fn(),
      newProject: vi.fn(),
    }
    render(
      <PartActionsContext.Provider value={actions}>
        <ProgressGrid projectId='p1' part={grid([picture({})])} />
      </PartActionsContext.Provider>
    )

    await user.click(
      screen.getByRole('button', { name: 'Main, show on the canvas' })
    )

    expect(openCanvas).toHaveBeenCalledWith(['n1'])
  })
})
