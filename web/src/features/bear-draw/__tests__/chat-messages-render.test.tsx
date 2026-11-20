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
import { render } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { useImageUrl } from '@/features/draw/hooks/use-image-url'
import { useMoney } from '@/features/draw/hooks/use-money'

import { Messages } from '../components/project/messages'
import type { AgentMessage, Project, UserMessage } from '../types'

// Each finished agent message renders its cost line with useMoney, and each
// picture sent with a user message reads its thumbnail with useImageUrl:
// their call counts show which messages rendered again.
vi.mock('@/features/draw/hooks/use-money', () => ({
  useMoney: vi.fn(() => ({ cost: (usd: number) => `$${usd}` })),
}))
vi.mock('@/features/draw/hooks/use-image-url', () => ({
  useImageUrl: vi.fn(() => null),
}))

const asked: UserMessage = {
  id: 'u1',
  role: 'user',
  at: 1,
  mode: 'agent',
  text: 'a poster for a tea shop',
  refs: [{ id: 'ref-1', w: 800, h: 800, name: 'logo.png' }],
}

const answered: AgentMessage = {
  id: 'a1',
  role: 'agent',
  mode: 'agent',
  status: 'done',
  startedAt: 1,
  endedAt: 2,
  cost: 0.02,
  parts: [{ id: 't1', type: 'text', text: 'Here is the first poster.' }],
}

const followUp: UserMessage = { ...asked, id: 'u2', text: 'now a second one' }

const writing = (text: string): AgentMessage => ({
  id: 'a2',
  role: 'agent',
  mode: 'agent',
  status: 'running',
  startedAt: 3,
  cost: 0,
  parts: [{ id: 't2', type: 'text', text, streaming: true }],
})

const project = (last: AgentMessage): Project => ({
  id: 'p1',
  title: 'Tea',
  createdAt: 1,
  updatedAt: 3,
  cost: 0.02,
  messages: [asked, answered, followUp, last],
  transcript: [],
  groups: [],
  nodes: [],
})

describe('the conversation while the agent writes', () => {
  test('a new delta re-renders only the message being written', () => {
    const view = render(<Messages project={project(writing('Making'))} />)
    const money = vi.mocked(useMoney).mock.calls.length
    const thumbs = vi.mocked(useImageUrl).mock.calls.length
    expect(money).toBeGreaterThan(0)
    expect(thumbs).toBeGreaterThan(0)

    view.rerender(<Messages project={project(writing('Making a second'))} />)

    expect(vi.mocked(useMoney).mock.calls.length).toBe(money)
    expect(vi.mocked(useImageUrl).mock.calls.length).toBe(thumbs)
  })
})
