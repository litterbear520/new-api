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
import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useBearChatStore } from '@/stores/bear-chat-store'

import { loadConversations, saveConversation } from '../../lib/storage'
import type { Conversation } from '../../types'
import { useChatPersistence } from '../use-chat-persistence'

vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))
vi.mock('../../lib/migrate', () => ({ takeOldPlayground: () => null }))
vi.mock('../../lib/storage', () => ({
  loadConversations: vi.fn(),
  saveConversation: vi.fn(),
  deleteConversation: vi.fn(),
  readSettings: () => ({}),
  writeSettings: () => undefined,
}))

const conv = (id: string, title = id): Conversation => ({
  id,
  title,
  createdAt: 1,
  updatedAt: 1,
  turns: [],
})

const full = () => new DOMException('full', 'QuotaExceededError')

afterEach(() => {
  vi.useRealTimers()
})

describe('useChatPersistence', () => {
  test('a failed save is told once and retried after a save that works', async () => {
    vi.mocked(loadConversations).mockResolvedValue([])
    const { result } = renderHook(() => useChatPersistence(1))
    await waitFor(() => expect(result.current).toBe('ready'))
    vi.useFakeTimers()

    vi.mocked(saveConversation).mockRejectedValue(full())
    act(() => useBearChatStore.getState().putConv(conv('x')))
    await vi.advanceTimersByTimeAsync(500)
    act(() => useBearChatStore.getState().putConv(conv('x', 'x2')))
    await vi.advanceTimersByTimeAsync(500)
    expect(saveConversation).toHaveBeenCalledTimes(2)
    expect(toast.warning).toHaveBeenCalledTimes(1)

    // Space again (e.g. old chats deleted): the next save retries x.
    vi.mocked(saveConversation).mockResolvedValue(undefined)
    act(() => useBearChatStore.getState().putConv(conv('y')))
    await vi.advanceTimersByTimeAsync(1000)
    const saved = vi.mocked(saveConversation).mock.calls.map(([, c]) => c.id)
    expect(saved.slice(2)).toEqual(['y', 'x'])
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })
})
