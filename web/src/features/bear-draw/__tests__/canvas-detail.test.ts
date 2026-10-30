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

import { createCanvas } from '../lib/canvas/canvas'
import type { CanvasApi } from '../lib/canvas/types'

const made: CanvasApi[] = []
let resize = () => {}

/** A 1000×600 canvas; jsdom has no layout, so the size is set by hand. */
function canvas(): CanvasApi {
  const root = document.createElement('div')
  document.body.append(root)
  const cv = createCanvas(root, { autoFocus: false })
  made.push(cv)
  Object.defineProperty(cv.el, 'clientWidth', { value: 1000 })
  Object.defineProperty(cv.el, 'clientHeight', { value: 600 })
  resize()
  return cv
}

/** What the picture shows on screen. */
const shown = (cv: CanvasApi, id: string) =>
  cv.el.querySelector<HTMLImageElement>(`[data-cv-id="${id}"] img`)?.src ?? null

/** Lets image decodes and the camera's rest timer (170 ms) run. */
const rest = () => new Promise((r) => setTimeout(r, 220))
const nextFrame = () =>
  new Promise<void>((r) => requestAnimationFrame(() => r()))

beforeEach(() => {
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
  vi.stubGlobal('devicePixelRatio', 1)
  // jsdom never decodes images.
  HTMLImageElement.prototype.decode = () => Promise.resolve()
})

afterEach(() => {
  for (const cv of made.splice(0)) cv.destroy()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('thumbnail first, full picture when it shows big', () => {
  const picture = { w: 1536, h: 1536, src: 'blob:full', thumb: 'blob:thumb' }

  test('zoomed out the thumbnail shows; zooming in swaps the full picture in once the camera rests and keeps it', async () => {
    const cv = canvas()
    cv.setCamera({ x: 100, y: 50, s: 0.25 })
    cv.addImage({ id: 'a', x: 0, y: 0, ...picture })
    await rest()
    expect(shown(cv, 'a')).toBe('blob:thumb')

    cv.zoomTo(1, { animate: false })
    expect(shown(cv, 'a')).toBe('blob:thumb')
    await rest()
    expect(shown(cv, 'a')).toBe('blob:full')

    cv.zoomTo(0.25, { animate: false })
    await rest()
    expect(shown(cv, 'a')).toBe('blob:full')
  })

  test('opening a project decodes thumbnails, then full pictures where the fitted camera needs them', async () => {
    const cv = canvas()
    const images = ['a', 'b'].map((id) => ({
      id,
      groupId: 'g',
      status: 'ready' as const,
      ...picture,
      src: `blob:${id}`,
    }))
    // As the project page does: no saved camera, so it fits everything.
    cv.setState({ camera: null, groups: [{ id: 'g', x: 0, y: 0 }], images })
    cv.focus(null, { animate: false })
    await rest()
    expect(shown(cv, 'a')).toBe('blob:thumb')
    cv.zoomTo(1, { animate: false })
    await rest()
    expect(shown(cv, 'a')).toBe('blob:a')
  })

  test('a picture opened zoomed in (saved camera) shows the full picture', async () => {
    const cv = canvas()
    cv.setState({
      camera: { x: 0, y: 0, s: 1 },
      groups: [],
      images: [{ id: 'a', x: 0, y: 0, status: 'ready', ...picture }],
    })
    await rest()
    expect(shown(cv, 'a')).toBe('blob:full')
  })

  test('a picture without a thumbnail shows its full file at once', async () => {
    const cv = canvas()
    cv.addImage({ id: 'a', x: 0, y: 0, w: 1536, h: 1536, src: 'blob:full' })
    cv.setCamera({ x: 0, y: 0, s: 0.1 })
    await rest()
    expect(shown(cv, 'a')).toBe('blob:full')
  })

  test('pictures off screen keep their thumbnails', async () => {
    const cv = canvas()
    cv.setCamera({ x: 0, y: 0, s: 0.25 })
    cv.addImage({ id: 'a', x: 0, y: 0, ...picture })
    cv.addImage({ id: 'far', x: 20000, y: 0, ...picture, src: 'blob:far' })
    await rest()
    cv.zoomTo(1, { animate: false })
    await rest()
    expect(shown(cv, 'far')).toBe('blob:thumb')
  })
})

describe('keeping the pictures framed', () => {
  test('a picture that changes size is framed again while nobody moved the camera', async () => {
    const cv = canvas()
    cv.addGroup({ id: 'g', x: 0, y: 0 })
    cv.addImage({ id: 'a', groupId: 'g', w: 800, h: 800 })
    cv.fit()
    await rest()
    const before = cv.getCamera().s
    cv.updateImage('a', { w: 800, h: 2400 })
    await rest()
    expect(cv.getCamera().s).toBeLessThan(before)
  })

  test('after the user zooms, size changes leave the camera alone', async () => {
    const cv = canvas()
    cv.addGroup({ id: 'g', x: 0, y: 0 })
    cv.addImage({ id: 'a', groupId: 'g', w: 800, h: 800 })
    cv.fit()
    cv.zoomTo(0.5, { animate: false })
    cv.updateImage('a', { w: 800, h: 2400 })
    await rest()
    expect(cv.getCamera().s).toBe(0.5)
  })
})

describe('frame titles', () => {
  const title = (cv: CanvasApi, id: string) =>
    cv.el.querySelector<HTMLElement>(`[data-cv-title="${id}"]`)

  test('far out, a title that would sit on the frame above hides; closer in it shows again', async () => {
    const cv = canvas()
    cv.addGroup({ id: 'g1', title: '主图', x: 0, y: 0 })
    cv.addImage({ id: 'a', groupId: 'g1', w: 800, h: 800 })
    cv.addGroup({ id: 'g2', title: '详情', x: 0, y: 1300 })
    cv.addImage({ id: 'b', groupId: 'g2', w: 800, h: 800 })

    cv.setCamera({ x: 40, y: 60, s: 0.04 })
    await nextFrame()
    expect(title(cv, 'g1')?.style.display).toBe('')
    expect(title(cv, 'g2')?.style.display).toBe('none')

    cv.setCamera({ x: 40, y: 60, s: 0.3 })
    await nextFrame()
    expect(title(cv, 'g2')?.style.display).toBe('')
  })

  test('a selected frame and a frame dragged over another keep their titles', async () => {
    const cv = canvas()
    cv.addGroup({ id: 'g1', title: '主图', x: 0, y: 0 })
    cv.addImage({ id: 'a', groupId: 'g1', w: 800, h: 800 })
    cv.addGroup({ id: 'g2', title: '详情', x: 0, y: 1300 })
    cv.addImage({ id: 'b', groupId: 'g2', w: 800, h: 800 })
    cv.addGroup({ id: 'g3', title: '海报', x: 200, y: 300 })
    cv.addImage({ id: 'c', groupId: 'g3', w: 400, h: 400 })

    cv.select(['g2'])
    cv.setCamera({ x: 40, y: 60, s: 0.04 })
    await nextFrame()
    expect(title(cv, 'g2')?.style.display).toBe('')

    cv.setCamera({ x: 40, y: 60, s: 0.3 })
    await nextFrame()
    expect(title(cv, 'g3')?.style.display).toBe('')
  })
})

describe('a hidden canvas', () => {
  test('leaves the keyboard to the page', () => {
    const cv = canvas()
    const key = (k: string) =>
      cv.el.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true })
      )
    cv.el.focus()
    key('h')
    expect(cv.getTool()).toBe('hand')
    cv.el.parentElement?.setAttribute('hidden', '')
    key('m')
    expect(cv.getTool()).toBe('hand')
  })
})
