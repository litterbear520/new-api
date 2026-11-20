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

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { useBearDrawPersistence } from '../hooks/use-persistence'
import { loadProjects, saveProject } from '../lib/storage'
import type { Project } from '../types'

vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))
vi.mock('../lib/storage', async (original) => ({
  ...(await original<typeof import('../lib/storage')>()),
  loadProjects: vi.fn(async () => []),
  saveProject: vi.fn(async () => {}),
}))
vi.mock('@/features/draw/lib/storage', async (original) => ({
  ...(await original<typeof import('@/features/draw/lib/storage')>()),
  loadRooms: vi.fn(async () => []),
}))

const project = (id: string, title = id): Project =>
  ({
    id,
    title,
    createdAt: 1,
    updatedAt: 1,
    cost: 0,
    messages: [{ id: `${id}-m`, role: 'user', text: 'hi', refs: [], at: 1 }],
    transcript: [],
    groups: [],
    nodes: [],
  }) as unknown as Project

const full = () => new DOMException('full', 'QuotaExceededError')

afterEach(() => vi.useRealTimers())

describe('saving projects', () => {
  test('a failed save is told once and retried after a save that works', async () => {
    vi.mocked(loadProjects).mockResolvedValue([])
    const { result } = renderHook(() => useBearDrawPersistence(1))
    await waitFor(() => expect(result.current).toBe('ready'))
    vi.useFakeTimers()

    vi.mocked(saveProject).mockRejectedValue(full())
    act(() => useBearDrawStore.getState().putProject(project('x')))
    await vi.advanceTimersByTimeAsync(600)
    act(() => useBearDrawStore.getState().putProject(project('x', 'x2')))
    await vi.advanceTimersByTimeAsync(600)
    expect(saveProject).toHaveBeenCalledTimes(2)
    expect(toast.warning).toHaveBeenCalledTimes(1)

    // Space again (old projects deleted): the next save retries x.
    vi.mocked(saveProject).mockResolvedValue(undefined)
    act(() => useBearDrawStore.getState().putProject(project('y')))
    await vi.advanceTimersByTimeAsync(1200)
    const saved = vi.mocked(saveProject).mock.calls.map(([, p]) => p.id)
    expect(saved.slice(2)).toEqual(['y', 'x'])
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })
})
