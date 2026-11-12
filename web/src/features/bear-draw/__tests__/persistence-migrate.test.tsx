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
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { loadRooms } from '@/features/draw/lib/storage'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { useBearDrawPersistence } from '../hooks/use-persistence'
import { loadProjects, removeProjectRecord, saveProject } from '../lib/storage'
import type { Project } from '../types'

vi.mock('../lib/storage', async (original) => ({
  ...(await original<typeof import('../lib/storage')>()),
  loadProjects: vi.fn(),
  removeProjectRecord: vi.fn(async () => {}),
  saveProject: vi.fn(async () => {}),
}))
vi.mock('@/features/draw/lib/storage', async (original) => ({
  ...(await original<typeof import('@/features/draw/lib/storage')>()),
  loadRooms: vi.fn(async () => []),
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

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  useBearDrawStore.setState({
    uid: null,
    loaded: false,
    projects: [],
    live: {},
  })
})

describe('copying the classic page’s conversations', () => {
  test('a copy that cannot be written deletes nothing already saved', async () => {
    vi.mocked(loadProjects).mockResolvedValue([project('existing-project')])
    vi.mocked(loadRooms).mockResolvedValue([
      {
        id: 'classic',
        title: 'classic',
        t: 1,
        model: 'image-model',
        msgs: [
          {
            id: 'classic-user',
            role: 'user',
            text: 'keep this',
            imgs: [],
            ratio: 'auto',
            clear: false,
          },
        ],
      } as Awaited<ReturnType<typeof loadRooms>>[number],
    ])
    vi.mocked(saveProject).mockRejectedValue(
      new DOMException('full', 'QuotaExceededError')
    )
    const hook = renderHook(() => useBearDrawPersistence(1))
    await waitFor(() => expect(saveProject).toHaveBeenCalled())
    await waitFor(() => expect(hook.result.current).toBe('ready'))
    await new Promise((r) => setTimeout(r, 0))
    expect(removeProjectRecord).not.toHaveBeenCalled()
    const ids = useBearDrawStore.getState().projects.map((p) => p.id)
    expect(ids).toContain('existing-project')
    expect(ids).toHaveLength(2)
  })
})
