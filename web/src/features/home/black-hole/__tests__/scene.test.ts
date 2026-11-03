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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  EARTH,
  HOLE,
  MAX_WIDTH,
  QUALITY_MIN,
  canvasSize,
  earthBox,
  FRAME_ASPECT,
  frameScale,
  gravityAt,
  newPace,
  paceFrame,
} from '../scene'

const W = 1920
const H = 1080
const holeAt = (w: number, h: number) => {
  const s = frameScale(w, h)
  return { x: w / 2 + HOLE.x * s, y: h / 2 - HOLE.y * s }
}

describe('gravityAt', () => {
  it('is full on the hole and on its disk', () => {
    const c = holeAt(W, H)
    expect(gravityAt(c.x, c.y, W, H)).toBe(1)
    expect(gravityAt(c.x + 300, c.y + 40, W, H)).toBe(1)
  })
  it('is nothing over the words, the Earth or the far sky', () => {
    const s = frameScale(W, H)
    expect(gravityAt(W / 2, 120, W, H)).toBe(0)
    expect(gravityAt(W / 2 + EARTH.x * s, H / 2 - EARTH.y * s, W, H)).toBe(0)
    expect(gravityAt(40, 40, W, H)).toBe(0)
  })
  it('fades, without a step, at the edge', () => {
    const c = holeAt(W, H)
    const values = Array.from({ length: 200 }, (_, i) =>
      gravityAt(c.x, c.y - i * 3, W, H)
    )
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1])
      expect(values[i - 1] - values[i]).toBeLessThan(0.08)
    }
  })
})

describe('canvasSize', () => {
  it('follows the box at one device pixel', () => {
    expect(canvasSize(1920, 1080, 1)).toEqual([1920, 1080])
  })
  it('caps the pixel ratio and the width', () => {
    expect(canvasSize(1440, 800, 2)).toEqual([2160, 1200])
    expect(canvasSize(3840, 2000, 2)[0]).toBe(MAX_WIDTH)
  })
  it('goes down with the quality', () => {
    expect(canvasSize(1000, 500, 1, 0.5)).toEqual([500, 250])
  })
})

describe('earthBox', () => {
  it('holds the whole Earth on a normal screen, inside the canvas', () => {
    const [x0, y0, x1, y1] = earthBox(W, H)
    const s = frameScale(W, H)
    expect(x1 - x0).toBeGreaterThanOrEqual(2 * EARTH.r * s)
    expect(y1 - y0).toBeGreaterThanOrEqual(2 * EARTH.r * s)
    expect(x0).toBeGreaterThanOrEqual(0)
    expect(y0).toBeGreaterThanOrEqual(0)
  })
  it('stays inside the canvas when the Earth is cut off', () => {
    const [x0, y0, x1, y1] = earthBox(200, 2000)
    expect(x0).toBeGreaterThanOrEqual(0)
    expect(y0).toBeGreaterThanOrEqual(0)
    expect(x1).toBeLessThanOrEqual(200)
    expect(y1).toBeLessThanOrEqual(2000)
  })
})

describe('the poster', () => {
  it('covers exactly the frame the engine draws', () => {
    // 2.4:1, as tall as the frame: min(240svh, 135cqw) of the window's width
    expect(2.4 / 1.35).toBeCloseTo(FRAME_ASPECT, 2)
    const css = readFileSync(
      resolve(import.meta.dirname, '../black-hole.css'),
      'utf8'
    )
    expect(css).toContain('width: min(240svh, 135cqw)')
    expect(css).not.toContain('max(240svh')
  })
})

describe('paceFrame', () => {
  it('keeps the quality while frames come on time', () => {
    const p = newPace(16.67)
    for (let i = 0; i < 300; i++) expect(paceFrame(p, 16.7, 1)).toBe('keep')
  })
  it('lowers the quality after a window with many late frames', () => {
    const p = newPace(16.67)
    let verdict = 'keep'
    for (let i = 0; i < 60; i++) verdict = paceFrame(p, i < 30 ? 40 : 17, 1)
    expect(verdict).toBe('lower')
  })
  it('ignores a few late frames', () => {
    const p = newPace(16.67)
    let verdict = 'keep'
    for (let i = 0; i < 60; i++) verdict = paceFrame(p, i < 10 ? 40 : 17, 1)
    expect(verdict).toBe('keep')
  })
  it('gives up on motion only once new shaders have had time to warm up', () => {
    const p = newPace(16.67)
    const verdicts: string[] = []
    // 50 ms apart: 20 s is frame 400, and the verdicts come every 60th frame
    for (let i = 0; i < 480; i++) verdicts.push(paceFrame(p, 50, QUALITY_MIN))
    expect(verdicts.slice(0, 400)).not.toContain('freeze')
    expect(verdicts[419]).toBe('freeze')
  })
  it('tries a step back up after a long calm: the slow start may have passed', () => {
    const p = newPace(16.67)
    const verdicts: string[] = []
    for (let i = 0; i < 60 * 25; i++) verdicts.push(paceFrame(p, 16.7, 0.75))
    expect(verdicts.indexOf('raise')).toBe(60 * 20 - 1)
  })
  it('stops trying after twice: a GPU that cannot hold it is left alone', () => {
    const p = newPace(16.67)
    const verdicts: string[] = []
    for (let i = 0; i < 60 * 100; i++) verdicts.push(paceFrame(p, 16.7, 0.75))
    expect(verdicts.filter((v) => v === 'raise')).toHaveLength(2)
  })
  it('never raises what is already at full quality', () => {
    const p = newPace(16.67)
    for (let i = 0; i < 60 * 40; i++) {
      expect(paceFrame(p, 16.7, 1)).toBe('keep')
    }
  })
  it('does not count a 30 Hz screen as late', () => {
    const p = newPace(33.3)
    let verdict = 'keep'
    for (let i = 0; i < 60; i++) verdict = paceFrame(p, 33.4, 1)
    expect(verdict).toBe('keep')
  })
})
