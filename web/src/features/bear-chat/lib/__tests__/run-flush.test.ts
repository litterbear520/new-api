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

import { useBearChatStore } from '@/stores/bear-chat-store'

import type { AssistantTurn } from '../../types'
import { sendMessage } from '../run'
import type { StreamEvent } from '../stream'

vi.mock('../stream', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../stream')>()),
  streamChat: vi.fn(),
}))

const { streamChat } = await import('../stream')

/** A model that sends `chunks` pieces of `size` characters, one every 25 ms. */
function fakeModel(chunks: number, size: number) {
  let release: (() => void) | undefined
  const ended = new Promise<void>((resolve) => {
    release = resolve
  })
  vi.mocked(streamChat).mockImplementation(async (_body, opts) => {
    const send = (e: StreamEvent) => opts.onEvent(e)
    for (let i = 0; i < chunks; i++) {
      await new Promise((r) => setTimeout(r, 25))
      send({ type: 'content', text: 'x'.repeat(size) })
    }
    release?.()
  })
  return ended
}

function shownContent(): string {
  const conv = useBearChatStore.getState().convs[0]
  const turn = conv?.turns.at(-1) as AssistantTurn | undefined
  return turn?.replies[0]?.content ?? ''
}

/** Counts store writes that changed the streaming text. */
function countWrites() {
  let last = ''
  let writes = 0
  const stop = useBearChatStore.subscribe(() => {
    const now = shownContent()
    if (now !== last) writes++
    last = now
  })
  return { stop, writes: () => writes }
}

describe('streaming writes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useBearChatStore.setState({ convs: [], curId: null, live: null })
    useBearChatStore.getState().setSettings({ model: 'test-model' })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.mocked(streamChat).mockReset()
  })

  test('a short reply is written every 50 ms, as before', async () => {
    const ended = fakeModel(40, 50)
    const count = countWrites()
    sendMessage('hi', [])
    await vi.advanceTimersByTimeAsync(1000)
    await ended
    await vi.advanceTimersByTimeAsync(0)
    count.stop()
    expect(shownContent()).toHaveLength(2000)
    // 40 chunks over 1 s at 50 ms: about 20 writes
    expect(count.writes()).toBeGreaterThanOrEqual(19)
  })

  test('a long reply is written less often and ends complete', async () => {
    // 400 chunks of 100 characters: 40,000 characters over 10 s
    const ended = fakeModel(400, 100)
    const count = countWrites()
    sendMessage('hi', [])
    await vi.advanceTimersByTimeAsync(10_000)
    await ended
    // no pending timer fires here: the end of the stream writes the rest
    await vi.advanceTimersByTimeAsync(0)
    count.stop()
    expect(shownContent()).toHaveLength(40_000)
    // every 50 ms would be about 200 writes
    expect(count.writes()).toBeLessThan(100)
    expect(useBearChatStore.getState().live).toBeNull()
  })
})
