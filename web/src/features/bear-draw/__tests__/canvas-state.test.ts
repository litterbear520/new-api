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

import { createCanvas } from '../lib/canvas/canvas'
import { LAY } from '../lib/canvas/geometry'
import type { CanvasApi, CanvasState } from '../lib/canvas/types'

const made: CanvasApi[] = []

function canvas(): CanvasApi {
  const root = document.createElement('div')
  document.body.append(root)
  const cv = createCanvas(root, { autoFocus: false })
  made.push(cv)
  return cv
}

afterEach(() => {
  for (const cv of made.splice(0)) cv.destroy()
  document.body.replaceChildren()
})

/** A set of three pictures and one picture outside any frame. */
function fill(cv: CanvasApi) {
  cv.addGroup({ id: 'g1', title: '淘宝主图', subtitle: '3 张', x: 0, y: 0 })
  cv.addImage({ id: 'a', groupId: 'g1', w: 800, h: 800, src: 'blob:a' })
  cv.addImage({ id: 'b', groupId: 'g1', w: 800, h: 800, status: 'pending' })
  cv.addImage({ id: 'c', groupId: 'g1', index: 0, w: 1024, h: 1536 })
  cv.addImage({ id: 'free', w: 2048, h: 1024, dw: 600, x: 3000, y: 500 })
  cv.setCamera({ x: -120, y: 40, s: 0.5 })
}

describe('canvas state', () => {
  test('getState then setState on a new canvas gives the same state', () => {
    const a = canvas()
    fill(a)
    const saved = a.getState()
    const b = canvas()
    b.setState(saved)
    // Pictures come back frame by frame, so compare them by id.
    const byId = (s: CanvasState) => ({
      ...s,
      images: [...s.images].sort((x, y) => x.id.localeCompare(y.id)),
    })
    expect(byId(b.getState())).toEqual(byId(saved))
  })

  test('index puts a picture first and the frame keeps that order', () => {
    const cv = canvas()
    fill(cv)
    expect(cv.getState().groups[0].children).toEqual(['c', 'a', 'b'])
  })

  test('only a resized picture remembers its width', () => {
    const cv = canvas()
    fill(cv)
    const byId = new Map(cv.getState().images.map((n) => [n.id, n]))
    expect(byId.get('free')?.dw).toBe(600)
    expect(byId.get('a')?.dw).toBeUndefined()
  })

  test('frames without a position are stacked below each other', () => {
    const cv = canvas()
    cv.setState({
      groups: [
        { id: 'g1', title: 'one', children: ['a'] },
        { id: 'g2', title: 'two', children: [] },
      ],
      images: [{ id: 'a', groupId: 'g1', w: 800, h: 600 }],
    })
    const [g1, g2] = cv.getState().groups
    const first = cv.getNode('g1')
    expect(first?.type).toBe('group')
    const bottom = first?.type === 'group' ? first.y + first.h : 0
    expect(g2.y).toBe(bottom + LAY.groupGap)
    expect(g2.x).toBe(g1.x)
  })

  test('removing a frame removes its pictures', () => {
    const cv = canvas()
    fill(cv)
    cv.remove('g1')
    expect(cv.getState().images.map((n) => n.id)).toEqual(['free'])
  })

  test('a waiting picture given its src becomes ready', () => {
    const cv = canvas()
    fill(cv)
    const n = cv.updateImage('b', { src: 'blob:b', w: 1024, h: 1024 })
    expect(n?.status).toBe('ready')
    expect(n?.dw).toBe(1024)
  })
})

describe('fitting the camera', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('the camera fits again while the canvas grows, until the user zooms', () => {
    let resize = () => {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resize = cb
        }
        observe() {}
        disconnect() {}
      }
    )
    const cv = canvas()
    cv.addGroup({ id: 'g', x: 0, y: 0 })
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      cv.addImage({ id, groupId: 'g', w: 800, h: 800 })
    }
    const size = (w: number) => {
      Object.defineProperty(cv.el, 'clientWidth', {
        value: w,
        configurable: true,
      })
      Object.defineProperty(cv.el, 'clientHeight', {
        value: 600,
        configurable: true,
      })
      resize()
    }
    size(200)
    const opening = cv.getCamera().s
    size(1000)
    expect(cv.getCamera().s).toBeGreaterThan(opening)
    cv.zoomTo(0.5, { animate: false })
    size(1200)
    expect(cv.getCamera().s).toBe(0.5)
  })
})
