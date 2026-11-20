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

import { storedImageIds } from '@/features/bear-draw/lib/storage'
import { useBearDrawStore } from '@/stores/bear-draw-store'
import { useDrawStore } from '@/stores/draw-store'

import type { DrawRoom } from '../../types'
import { deleteRoomWithUndo } from '../actions'
import { deleteRoom } from '../storage'

vi.mock('@/features/bear-draw/lib/storage', async (original) => ({
  ...(await original<typeof import('@/features/bear-draw/lib/storage')>()),
  storedImageIds: vi.fn(async () => new Set<string>()),
}))
vi.mock('../storage', async (original) => ({
  ...(await original<typeof import('../storage')>()),
  deleteRoom: vi.fn(async () => {}),
}))

const room = (id: string, imgs: string[]): DrawRoom =>
  ({
    id,
    title: id,
    model: 'm',
    t: 1,
    msgs: [
      {
        id: `${id}-u`,
        role: 'user',
        text: '',
        imgs: imgs.map((i) => ({ id: i })),
      },
    ],
  }) as unknown as DrawRoom

async function deleteAfterUndoWindow(r: DrawRoom) {
  deleteRoomWithUndo(r)
  await vi.advanceTimersByTimeAsync(6000)
  await vi.waitFor(() => expect(deleteRoom).toHaveBeenCalled())
  return vi.mocked(deleteRoom).mock.calls[0][1]
}

describe('deleting a classic conversation', () => {
  const doomed = room('r1', ['shared', 'only-here'])

  beforeEach(() => {
    vi.useFakeTimers()
    useDrawStore.getState().reset()
    useDrawStore.getState().init(7, [doomed, room('r2', ['other'])])
    useBearDrawStore.setState({ uid: null, projects: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  test('keeps pictures that a stored project of the new page uses', async () => {
    vi.mocked(storedImageIds).mockResolvedValueOnce(new Set(['shared']))
    const keep = await deleteAfterUndoWindow(doomed)
    expect(storedImageIds).toHaveBeenCalledWith(7)
    expect(keep.has('shared')).toBe(true)
    expect(keep.has('only-here')).toBe(false)
  })

  test('keeps every picture when the projects cannot be read', async () => {
    vi.mocked(storedImageIds).mockRejectedValueOnce(new Error('no IndexedDB'))
    const keep = await deleteAfterUndoWindow(doomed)
    expect(keep.has('shared')).toBe(true)
    expect(keep.has('only-here')).toBe(true)
  })
})
