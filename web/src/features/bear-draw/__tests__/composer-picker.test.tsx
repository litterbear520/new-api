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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { Composer } from '../components/composer/composer'
import { DEFAULT_PREFS } from '../constants'
import type { Project } from '../types'

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

/** A project whose canvas has one finished picture, 首图. */
const project: Project = {
  id: 'p1',
  title: '保温杯',
  createdAt: 1,
  updatedAt: 1,
  cost: 0,
  messages: [],
  transcript: [],
  groups: [{ id: 'g1', title: '淘宝主图', children: ['n1'] }],
  nodes: [
    {
      id: 'n1',
      groupId: 'g1',
      status: 'ready',
      img: { id: 'img-n1', w: 800, h: 800 },
      w: 800,
      h: 800,
      label: '首图',
      meta: {},
    },
  ],
}

function setup(projectId?: string) {
  const onSend = vi.fn()
  render(<Composer variant='dock' projectId={projectId} onSend={onSend} />)
  const box = screen.getByRole('textbox', {
    name: 'Describe what you want to design',
  })
  return { onSend, box, user: userEvent.setup() }
}

beforeEach(() => {
  useBearDrawStore.setState({
    prefs: { ...DEFAULT_PREFS },
    brandKit: null,
    mySkills: [],
    live: {},
    projects: [project],
  })
})

describe('Composer "/" skill picker', () => {
  it('opens on "/" and narrows the skills as you type', async () => {
    const { box, user } = setup()
    await user.type(box, '/')
    const list = screen.getByRole('listbox', { name: 'Which skill?' })
    expect(within(list).getAllByRole('option').length).toBeGreaterThan(1)

    await user.type(box, '小红书')
    const options = within(list).getAllByRole('option')
    expect(options[0]).toHaveTextContent('小红书封面')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('picks the highlighted skill on Enter, removes "/word" and sends the skill', async () => {
    const { box, onSend, user } = setup()
    await user.type(box, '/淘宝主图')
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box).toHaveValue('')
    expect(screen.getByText('淘宝主图套图')).toBeVisible()

    await user.type(box, '保温杯')
    await user.keyboard('{Enter}')
    expect(onSend).toHaveBeenCalledWith({
      text: '保温杯',
      mode: 'agent',
      refs: [],
      skillId: 'taobao-main-set',
    })
  })

  it('closes on Escape and keeps the typed text', async () => {
    const { box, onSend, user } = setup()
    await user.type(box, '/海报')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(box).toHaveValue('/海报')
    expect(onSend).not.toHaveBeenCalled()
  })
})

describe('Composer "@" canvas picker', () => {
  it('inserts "@label" and attaches the canvas picture', async () => {
    const { box, onSend, user } = setup('p1')
    await user.type(box, '把@')
    const list = screen.getByRole('listbox', {
      name: 'Use a picture from the canvas',
    })
    expect(within(list).getByRole('option')).toHaveTextContent('首图')
    await user.keyboard('{Enter}')
    expect(box).toHaveValue('把@首图 ')

    await user.type(box, '换成蓝色')
    await user.keyboard('{Enter}')
    expect(onSend).toHaveBeenCalledWith({
      text: '把@首图 换成蓝色',
      mode: 'agent',
      refs: [{ id: 'img-n1', w: 800, h: 800, nodeId: 'n1', label: '首图' }],
    })
  })

  it('does not open "@" on the home page, where there is no canvas', async () => {
    const { box, user } = setup()
    await user.type(box, '@')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
