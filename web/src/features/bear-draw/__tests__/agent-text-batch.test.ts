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
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { ChatRequestError } from '@/features/bear-chat/lib/stream'
import { useAuthStore } from '@/stores/auth-store'
import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import { loop, newRun, setAgentModels, stopRun } from '../lib/agent/run'
import { streamStep, type StepResult } from '../lib/agent/stream'
import type { Part, Project } from '../types'

vi.mock('../lib/agent/stream', async (original) => ({
  ...(await original<typeof import('../lib/agent/stream')>()),
  streamStep: vi.fn(),
}))

/** The planner's streamed reply, driven by the test. */
type FakeStream = {
  say: (text: string) => void
  end: (text: string) => void
  fail: (error: unknown) => void
}

let stream: Promise<FakeStream>

function fakeStream() {
  stream = new Promise((started) => {
    vi.mocked(streamStep).mockImplementation(
      (_body, opts) =>
        new Promise<StepResult>((resolve, reject) => {
          opts.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
          started({
            say: (text) => opts.onEvent({ type: 'text', text }),
            end: (text) =>
              resolve({ text, toolCalls: [], finish: 'stop', usage: null }),
            fail: reject,
          })
        })
    )
  })
}

/** Animation frames run only when the test says so (a hidden tab runs none). */
let frames = new Map<number, FrameRequestCallback>()
let frameId = 0
function runFrame() {
  const due = [...frames.values()]
  frames.clear()
  for (const cb of due) cb(performance.now())
}

function project(): Project {
  return {
    id: 'stream-test',
    title: 'stream-test',
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

function parts(): Part[] {
  const m = findProject('stream-test')?.messages[0]
  return m?.role === 'agent' ? m.parts : []
}

const textParts = () =>
  parts().filter((x): x is Extract<Part, { type: 'text' }> => x.type === 'text')

/** Counts edits of the project in the store. */
function countEdits() {
  const count = { n: 0 }
  const stop = useBearDrawStore.subscribe((s, prev) => {
    if (s.projects !== prev.projects) count.n++
  })
  return { count, stop }
}

const deltas = ['Here is ', 'a warm ', 'poster ', 'with ', 'tea leaves.  ']

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  frames = new Map()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++frameId, cb)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
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
  fakeStream()
})

afterEach(() => {
  stopRun('stream-test')
  useBearDrawStore.setState({
    uid: null,
    loaded: false,
    projects: [],
    live: {},
  })
  vi.mocked(streamStep).mockReset()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  useAuthStore.getState().auth.reset()
})

describe('the agent writing text', () => {
  test('deltas within one frame reach the project in one edit per frame', async () => {
    void loop(newRun('stream-test', 'agent'))
    const s = await stream
    const edits = countEdits()
    for (const d of deltas) s.say(d)
    expect(edits.count.n).toBe(0)
    runFrame()
    expect(edits.count.n).toBe(1)
    for (const d of deltas) s.say(d)
    runFrame()
    edits.stop()
    expect(edits.count.n).toBe(2)
    expect(textParts().map((x) => x.text)).toEqual([deltas.join('').repeat(2)])
    s.end(deltas.join(''))
  })

  test('a hidden tab (no frames) still gets the text, in one edit', async () => {
    void loop(newRun('stream-test', 'agent'))
    const s = await stream
    const edits = countEdits()
    for (const d of deltas) s.say(d)
    vi.advanceTimersByTime(250)
    edits.stop()
    expect(edits.count.n).toBe(1)
    expect(textParts().map((x) => x.text)).toEqual([deltas.join('')])
    s.end(deltas.join(''))
  })

  test('the end of the stream keeps every word, though no frame ran', async () => {
    const task = loop(newRun('stream-test', 'agent'))
    const s = await stream
    for (const d of deltas) s.say(d)
    s.end(deltas.join(''))
    await task
    expect(frames.size).toBe(0)
    expect(textParts()).toMatchObject([
      { text: 'Here is a warm poster with tea leaves.', streaming: false },
    ])
    expect(parts().some((x) => x.type === 'status' && x.live)).toBe(false)
  })

  test('stopping mid-stream keeps the words written so far', async () => {
    const task = loop(newRun('stream-test', 'agent'))
    const s = await stream
    s.say('Here is ')
    runFrame()
    s.say('a warm ')
    stopRun('stream-test')
    await task
    expect(textParts()).toMatchObject([
      { text: 'Here is a warm ', streaming: false },
    ])
  })

  test('an error mid-stream keeps the words written so far', async () => {
    const task = loop(newRun('stream-test', 'agent'))
    const s = await stream
    s.say('Here is ')
    s.say('a warm ')
    s.fail(new ChatRequestError('upstream closed', { early: false }))
    await task
    expect(textParts()).toMatchObject([
      { text: 'Here is a warm ', streaming: false },
    ])
    expect(parts().some((x) => x.type === 'error')).toBe(true)
  })
})
