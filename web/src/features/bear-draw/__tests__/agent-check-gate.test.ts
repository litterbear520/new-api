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
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'
import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import { drawPlan } from '../lib/agent/plan'
import { loop, newRun, setAgentModels, stopRun } from '../lib/agent/run'
import { streamStep } from '../lib/agent/stream'
import type { ApiToolCall, Part, Project } from '../types'

vi.mock('../lib/agent/stream', async (original) => ({
  ...(await original<typeof import('../lib/agent/stream')>()),
  streamStep: vi.fn(),
}))
vi.mock('../lib/agent/plan', async (original) => ({
  ...(await original<typeof import('../lib/agent/plan')>()),
  drawPlan: vi.fn(),
}))
vi.mock('../lib/pictures', async (original) => ({
  ...(await original<typeof import('../lib/pictures')>()),
  picturesEnv: () => ({}),
}))

const planCall = (id: string): ApiToolCall => ({
  id,
  type: 'function',
  function: {
    name: 'propose_plan',
    arguments: JSON.stringify({
      title: 'poster',
      items: [{ label: 'poster', prompt: 'a tea poster', ratio: '1:1' }],
    }),
  },
})

function project(): Project {
  return {
    id: 'gate-test',
    title: 'gate-test',
    createdAt: 1,
    updatedAt: 1,
    cost: 0,
    messages: [
      {
        id: 'agent',
        role: 'agent',
        mode: 'agent',
        status: 'running',
        startedAt: 1,
        cost: 0,
        parts: [],
      },
    ],
    transcript: [{ role: 'user', content: 'a poster for a tea shop' }],
    groups: [],
    nodes: [],
  }
}

beforeEach(() => {
  localStorage.clear()
  useAuthStore.getState().auth.setBundle({
    user: { id: 1, username: 'fixture-user-1', role: 1 },
    access_token: 'fixture-access-1',
    token_type: 'Bearer',
    access_expires_at: Math.floor(Date.now() / 1000) + 3600,
    session: {
      sid: 'fixture-session-1',
      current: true,
      login_method: 'password',
      ip: '',
      user_agent: '',
      created_at: 1,
      last_active_at: 1,
      expires_at: 9999999999,
    },
  })
  setAgentModels(['gpt-6-luna'])
  useBearDrawStore.setState({ live: {}, mySkills: [], draft: null })
  useBearDrawStore.getState().init(1, [project()])
})

afterEach(() => {
  stopRun('gate-test')
  useBearDrawStore.setState({
    uid: null,
    loaded: false,
    projects: [],
    live: {},
  })
  vi.mocked(streamStep).mockReset()
  vi.mocked(drawPlan).mockReset()
  useAuthStore.getState().auth.reset()
})

test('a plan made after pictures were drawn in the same turn waits for the user', async () => {
  const replies = [[planCall('c1')], [planCall('c2')]]
  vi.mocked(streamStep).mockImplementation(async () => ({
    text: '',
    toolCalls: replies.shift() ?? [],
    finish: 'tool_calls',
    usage: null,
  }))
  vi.mocked(drawPlan).mockResolvedValue({ groupId: 'g', results: [], cost: 0 })

  await loop(newRun('gate-test', 'agent'))

  const m = findProject('gate-test')?.messages[0]
  const plans = (m?.role === 'agent' ? m.parts : []).filter(
    (x): x is Extract<Part, { type: 'plan' }> => x.type === 'plan'
  )
  expect(plans.map((x) => x.state)).toEqual(['auto', 'pending'])
  expect(drawPlan).toHaveBeenCalledTimes(1)
  expect(m?.role === 'agent' && m.status).toBe('waiting')
})
