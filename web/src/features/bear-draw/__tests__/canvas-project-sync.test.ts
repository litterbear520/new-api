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
import { afterEach, describe, expect, test, vi } from 'vitest'

import { syncCanvas } from '../components/canvas/canvas-sync'
import { createHalftones } from '../components/canvas/halftones'
import { createProjectSync } from '../components/canvas/use-canvas-view'
import { createCanvas } from '../lib/canvas/canvas'
import type { CanvasApi } from '../lib/canvas/types'
import type { CanvasNode, Project } from '../types'

vi.mock('../components/canvas/canvas-sync', async (original) => {
  const real =
    await original<typeof import('../components/canvas/canvas-sync')>()
  return { ...real, syncCanvas: vi.fn(real.syncCanvas) }
})

/** Picture files: none in memory until loadImageUrl reads them. */
const files = new Map<string, string>()
vi.mock('@/features/draw/lib/images', () => ({
  cachedImageUrl: (id: string, variant: string) =>
    files.get(`${id}:${variant}`) ?? null,
  loadImageUrl: async (id: string, variant: string) => {
    const url = `blob:${id}-${variant}`
    files.set(`${id}:${variant}`, url)
    return url
  },
}))

const node = (id: string, over: Partial<CanvasNode> = {}): CanvasNode => ({
  id,
  groupId: null,
  status: 'pending',
  w: 1024,
  h: 1024,
  x: 0,
  y: 0,
  label: id,
  meta: {},
  ...over,
})

function project(nodes: CanvasNode[]): Project {
  return {
    id: 'p1',
    title: 'Set',
    createdAt: 1,
    updatedAt: 1,
    cost: 0,
    messages: [],
    transcript: [],
    groups: [],
    nodes,
  }
}

/** The agent wrote more text: a new project, the same pictures. */
const chatEdit = (p: Project, n: number): Project => ({
  ...p,
  updatedAt: p.updatedAt + n,
  transcript: [...p.transcript, { role: 'user', content: `line ${n}` }],
})

const made: CanvasApi[] = []
function setup(first: Project) {
  let current = first
  const root = document.createElement('div')
  document.body.append(root)
  const cv = createCanvas(root, { autoFocus: false })
  made.push(cv)
  const sync = createProjectSync(
    cv,
    createHalftones(() => current),
    () => current,
    () => {}
  )
  const apply = (p: Project) => {
    current = p
    sync.apply(p)
  }
  apply(first)
  return { cv, apply, stop: sync.stop }
}

afterEach(() => {
  for (const cv of made.splice(0)) cv.destroy()
  document.body.replaceChildren()
  files.clear()
  vi.mocked(syncCanvas).mockClear()
})

describe('keeping the canvas in step with the project', () => {
  test('edits that leave pictures and frames alone do not sync the canvas', () => {
    let p = project([node('a'), node('b')])
    const s = setup(p)
    for (let i = 1; i <= 5; i++) {
      p = chatEdit(p, i)
      s.apply(p)
    }
    expect(syncCanvas).not.toHaveBeenCalled()
    s.stop()
  })

  test('a new picture after chat-only edits is synced and shown', () => {
    let p = project([node('a')])
    const s = setup(p)
    p = chatEdit(p, 1)
    s.apply(p)
    p = { ...p, nodes: [...p.nodes, node('b', { x: 1200 })] }
    s.apply(p)
    expect(syncCanvas).toHaveBeenCalledTimes(1)
    expect(s.cv.getNode('b')?.type).toBe('image')
    s.stop()
  })

  test('a picture whose file loads later shows, though the project did not change', async () => {
    const p = project([
      node('a', { status: 'ready', img: { id: 'img-a', w: 1024, h: 1024 } }),
    ])
    const s = setup(p)
    expect(s.cv.getNode('a')).toMatchObject({ status: 'pending' })
    s.apply(chatEdit(p, 1))
    await vi.waitFor(() =>
      expect(s.cv.getNode('a')).toMatchObject({
        status: 'ready',
        src: 'blob:img-a-full',
      })
    )
    s.stop()
  })
})
