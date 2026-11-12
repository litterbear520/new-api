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
import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'
import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import { activeRun, setAgentModels } from '../lib/agent/run'
import { send, stop } from '../lib/engine'
import type { Project } from '../types'

vi.mock('../lib/storage', async (original) => ({
  ...(await original<typeof import('../lib/storage')>()),
  removeProjectRecord: vi.fn(async () => {}),
  saveProject: vi.fn(async () => {}),
}))
vi.mock('@/features/draw/lib/storage', async (original) => ({
  ...(await original<typeof import('@/features/draw/lib/storage')>()),
  getImageBlob: vi.fn(async () => null),
}))
vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  getSelf: vi.fn(async () => ({ success: false })),
}))

const project = (id: string): Project => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  cost: 0,
  messages: [],
  transcript: [],
  groups: [],
  nodes: [],
})

function login(uid: number) {
  useAuthStore.getState().auth.setBundle({
    user: { id: uid, username: `fixture-user-${uid}`, role: 1 },
    access_token: `fixture-access-${uid}`,
    token_type: 'Bearer',
    access_expires_at: Math.floor(Date.now() / 1000) + 3600,
    session: {
      sid: `fixture-session-${uid}`,
      current: true,
      login_method: 'password',
      ip: '',
      user_agent: '',
      created_at: 1,
      last_active_at: 1,
      expires_at: 9999999999,
    },
  })
}

function reply(content: string, tool?: { name: string; args: unknown }) {
  const message = {
    content,
    ...(tool
      ? {
          tool_calls: [
            {
              id: 'call-fixture',
              type: 'function',
              function: {
                name: tool.name,
                arguments: JSON.stringify(tool.args),
              },
            },
          ],
        }
      : {}),
  }
  return new Response(
    JSON.stringify({
      choices: [{ message, finish_reason: tool ? 'tool_calls' : 'stop' }],
    }),
    { headers: { 'content-type': 'application/json' } }
  )
}

beforeEach(() => {
  localStorage.clear()
  useBearDrawStore.setState({
    uid: null,
    loaded: false,
    projects: [],
    live: {},
    mySkills: [],
    draft: null,
  })
  setAgentModels(['gpt-6-luna'])
  login(1)
  useBearDrawStore.getState().init(1, [])
})

afterEach(() => {
  for (const p of useBearDrawStore.getState().projects) {
    stop(p.id, { quiet: true })
  }
  useBearDrawStore.setState({
    uid: null,
    loaded: false,
    projects: [],
    live: {},
  })
  vi.unstubAllGlobals()
  useAuthStore.getState().auth.reset()
})

describe('answering a question card with a new picture', () => {
  test('the picture reaches the planner after the answer', async () => {
    const fetchMock = vi.fn(async () => reply('answer received'))
    vi.stubGlobal('fetch', fetchMock)
    const p = project('waiting-test')
    p.messages = [
      {
        id: 'agent',
        role: 'agent',
        mode: 'agent',
        status: 'waiting',
        startedAt: 1,
        cost: 0,
        parts: [
          {
            id: 'questions',
            type: 'questions',
            callId: 'question-call',
            items: [{ q: 'Which product?', options: ['A', 'B'] }],
            answers: null,
          },
        ],
      },
    ]
    p.transcript = [
      { role: 'user', content: 'design a product image' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'question-call',
            type: 'function',
            function: { name: 'ask_user', arguments: '{}' },
          },
        ],
      },
    ]
    useBearDrawStore.getState().init(1, [p])
    send(p.id, {
      mode: 'agent',
      text: 'Use this new product',
      refs: [{ id: 'new-product', w: 100, h: 100 }],
    })
    await waitFor(() => expect(activeRun(p.id)).toBeNull())
    const roles = (findProject(p.id)?.transcript ?? []).map((m) =>
      m.role === 'user' ? `user:${m.images?.join(',') ?? ''}` : m.role
    )
    expect(roles).toEqual([
      'user:',
      'assistant',
      'tool',
      'user:new-product',
      'assistant',
    ])
  })
})
