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
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { deleteImages } from '@/features/draw/lib/storage'
import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import { deleteProject } from '../lib/engine'
import { removeProjectRecord } from '../lib/storage'
import type { CanvasNode, Project } from '../types'

vi.mock('../lib/storage', async (original) => ({
  ...(await original<typeof import('../lib/storage')>()),
  removeProjectRecord: vi.fn(async () => {}),
  saveProject: vi.fn(async () => {}),
}))
vi.mock('@/features/draw/lib/storage', async (original) => ({
  ...(await original<typeof import('@/features/draw/lib/storage')>()),
  deleteImages: vi.fn(async () => {}),
}))
vi.mock('sonner', () => {
  const toast = Object.assign(vi.fn(), { error: vi.fn() })
  return { toast }
})

const project = (id: string, img: string): Project => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  cost: 0,
  messages: [],
  transcript: [],
  groups: [],
  nodes: [{ id: `${id}-n`, img: { id: img } } as unknown as CanvasNode],
})

describe('deleteProject', () => {
  beforeEach(() => {
    useBearDrawStore.setState({ uid: null, loaded: false, projects: [] })
    useBearDrawStore.getState().init(1, [project('p1', 'img-a')])
  })
  afterEach(() => vi.clearAllMocks())

  test('keeps the project and its pictures when the record is not deleted', async () => {
    vi.mocked(removeProjectRecord).mockRejectedValueOnce(new Error('aborted'))
    await deleteProject('p1')
    expect(findProject('p1')).toBeTruthy()
    expect(deleteImages).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  test('deletes the pictures only it uses once the record is gone', async () => {
    await deleteProject('p1')
    expect(findProject('p1')).toBeNull()
    expect(removeProjectRecord).toHaveBeenCalledTimes(1)
    expect([...vi.mocked(deleteImages).mock.calls[0][0]]).toEqual(['img-a'])
  })

  test('keeps pictures another project needs to draw again or to plan', async () => {
    const other: Project = {
      ...project('p2', 'img-own'),
      messages: [
        {
          role: 'agent',
          parts: [
            {
              type: 'progress',
              items: [{ job: { inputs: ['img-a'] } }],
            },
          ],
        },
      ] as unknown as Project['messages'],
      transcript: [{ role: 'user', content: 'x', images: ['img-b'] }],
    }
    useBearDrawStore.setState({ uid: null, loaded: false, projects: [] })
    useBearDrawStore.getState().init(1, [
      {
        ...project('p1', 'img-a'),
        nodes: [
          { id: 'n1', img: { id: 'img-a' } },
          { id: 'n2', img: { id: 'img-b' } },
        ] as unknown as CanvasNode[],
      },
      other,
    ])
    await deleteProject('p1')
    expect(findProject('p1')).toBeNull()
    const dropped = vi
      .mocked(deleteImages)
      .mock.calls.flatMap(([ids]) => [...ids])
    expect(dropped).toEqual([])
  })

  test('stays deleted when cleaning the pictures fails', async () => {
    vi.mocked(deleteImages).mockRejectedValueOnce(new Error('aborted'))
    await deleteProject('p1')
    expect(findProject('p1')).toBeNull()
    expect(toast.error).not.toHaveBeenCalled()
  })
})
