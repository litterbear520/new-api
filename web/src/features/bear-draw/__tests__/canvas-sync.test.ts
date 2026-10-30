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
import { afterEach, describe, expect, test } from 'vitest'

import {
  applyCanvasState,
  projectToState,
  syncCanvas,
  type SrcOf,
} from '../components/canvas/canvas-sync'
import { createCanvas } from '../lib/canvas/canvas'
import type { CanvasApi } from '../lib/canvas/types'
import type { CanvasNode, Project } from '../types'

const node = (id: string, over: Partial<CanvasNode> = {}): CanvasNode => ({
  id,
  groupId: 'g1',
  status: 'pending',
  w: 1024,
  h: 1024,
  label: id,
  meta: {},
  ...over,
})

function project(nodes: CanvasNode[], over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    title: 'Set',
    createdAt: 1,
    updatedAt: 100,
    cost: 0,
    messages: [],
    transcript: [],
    groups: [
      {
        id: 'g1',
        title: '淘宝主图',
        x: 0,
        y: 0,
        children: nodes.filter((n) => n.groupId === 'g1').map((n) => n.id),
      },
    ],
    nodes,
    ...over,
  }
}

const srcOf: SrcOf = (n) => (n.img ? `blob:${n.img.id}` : null)

const made: CanvasApi[] = []
function shown(p: Project): CanvasApi {
  const root = document.createElement('div')
  document.body.append(root)
  const cv = createCanvas(root, { autoFocus: false })
  cv.setState(projectToState(p, srcOf))
  made.push(cv)
  return cv
}

afterEach(() => {
  for (const cv of made.splice(0)) cv.destroy()
  document.body.replaceChildren()
})

describe('applyCanvasState (saving canvas moves)', () => {
  test('nothing moved: the same project object comes back', () => {
    const p = project([node('a')], { camera: { x: 80, y: 80, s: 1 } })
    const cv = shown(p)
    expect(applyCanvasState(p, cv.getState())).toBe(p)
  })

  test('a camera move is saved without changing updatedAt', () => {
    const p = project([node('a')])
    const cv = shown(p)
    cv.setCamera({ x: 10, y: 20, s: 0.5 })
    const next = applyCanvasState(p, cv.getState())
    expect(next.camera).toEqual({ x: 10, y: 20, s: 0.5 })
    expect(next.updatedAt).toBe(100)
  })

  test('after a fit the saved camera is dropped, so the next visit fits', () => {
    const p = project([node('a')], { camera: { x: 10, y: 20, s: 0.5 } })
    const cv = shown(p)
    cv.fit()
    expect(applyCanvasState(p, cv.getState()).camera).toBeNull()
  })

  test('a picture dragged out of its frame is saved as a free picture', () => {
    const p = project([node('a'), node('b')], {
      camera: { x: 80, y: 80, s: 1 },
    })
    const cv = shown(p)
    cv.updateImage('b', { groupId: null, x: 3000, y: 200 })
    const next = applyCanvasState(p, cv.getState())
    expect(next.groups[0].children).toEqual(['a'])
    expect(next.nodes[1]).toMatchObject({ groupId: null, x: 3000, y: 200 })
  })

  test('pictures the canvas does not show yet keep their place in the frame', () => {
    const p = project([node('a')], { camera: { x: 80, y: 80, s: 1 } })
    const cv = shown(p)
    const later = project([node('a'), node('b')], { camera: p.camera })
    expect(applyCanvasState(later, cv.getState()).groups[0].children).toEqual([
      'a',
      'b',
    ])
  })
})

describe('syncCanvas (project → canvas)', () => {
  test('a picture that finished shows as ready with its file', () => {
    const p = project([node('a', { meta: { startedAt: 1 } })])
    const cv = shown(p)
    const img = { id: 'i1', w: 1024, h: 1536 }
    const next = project([node('a', { status: 'ready', img, h: 1536 })])
    syncCanvas(cv, p, next, srcOf)
    expect(cv.getNode('a')).toMatchObject({
      status: 'ready',
      src: 'blob:i1',
      h: 1536,
    })
  })

  test('a free picture the user moved stays put when something else changes', () => {
    const free = node('f', { groupId: null, x: 2000, y: 0 })
    const p = project([node('a'), free])
    const cv = shown(p)
    cv.updateImage('f', { x: 2500, y: 300 })
    const next = project([node('a', { label: 'renamed' }), free])
    syncCanvas(cv, p, next, srcOf)
    expect(cv.getNode('f')).toMatchObject({ x: 2500, y: 300 })
    expect(cv.getNode('a')).toMatchObject({ label: 'renamed' })
  })

  test('a picture removed from the project leaves the canvas', () => {
    const p = project([node('a'), node('b')])
    const cv = shown(p)
    const added = syncCanvas(cv, p, project([node('a'), node('c')]), srcOf)
    expect(cv.getNode('b')).toBeNull()
    expect(added).toEqual(['c'])
  })
})
