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
import { describe, expect, test } from 'vitest'

import {
  dispSize,
  finishStroke,
  fitCamera,
  flow,
  LAY,
} from '../lib/canvas/geometry'
import type { UV } from '../lib/canvas/types'

const squares = (n: number, size = 800) =>
  Array.from({ length: n }, () => ({ w: size, h: size }))

describe('flow (a frame’s rows)', () => {
  test('an empty frame keeps the placeholder size', () => {
    expect(flow([])).toEqual({ pos: [], w: LAY.emptyW, h: LAY.emptyH })
  })

  test('six pictures put the sixth on a new row', () => {
    const r = flow(squares(6))
    expect(r.pos.slice(0, 5).map((p) => p.y)).toEqual([40, 40, 40, 40, 40])
    expect(r.pos[5]).toEqual({ x: LAY.pad, y: 40 + 800 + LAY.rowGap })
    expect(r.w).toBe(40 + 5 * 800 + 4 * 32 + 40)
    expect(r.h).toBe(40 + 800 + 40 + 800 + 40)
  })

  test('wide pictures wrap before the row passes its maximum width', () => {
    const r = flow(squares(4, 1600))
    expect(r.pos.map((p) => p.y)).toEqual([40, 40, 40, 40 + 1600 + 40])
    expect(r.w).toBeLessThanOrEqual(LAY.maxRowW)
  })
})

describe('dispSize', () => {
  test('a picture wider than 1200 shows 1200 wide with its shape', () => {
    expect(dispSize(2048, 1024)).toEqual([1200, 600])
  })

  test('the width the user gave wins over the picture width', () => {
    expect(dispSize(1024, 1536, 300)).toEqual([300, 450])
  })
})

describe('fitCamera', () => {
  test('a small frame is centred at 100%, never zoomed past it', () => {
    const cam = fitCamera({ x: 0, y: 0, w: 200, h: 100 }, 1000, 800)
    expect(cam.s).toBe(1)
    // Centre of the free area: (56 + 888 / 2, 96 + 608 / 2).
    expect(cam.x + 100 * cam.s).toBeCloseTo(56 + 888 / 2)
    expect(cam.y + 50 * cam.s).toBeCloseTo(96 + 608 / 2)
  })

  test('a big set is zoomed out until it fits the free area', () => {
    const cam = fitCamera({ x: 0, y: 0, w: 4000, h: 1000 }, 1000, 800)
    expect(cam.s).toBeCloseTo(888 / 4000)
  })
})

describe('finishStroke (圈选)', () => {
  const ring = (k: number): UV[] =>
    Array.from({ length: k + 1 }, (_, i) => {
      const a = (i / k) * Math.PI * 2
      return [0.5 + 0.2 * Math.cos(a), 0.5 + 0.2 * Math.sin(a)]
    })

  test('a twitch smaller than 10 screen px is not a mark', () => {
    const twitch: UV[] = [
      [0.5, 0.5],
      [0.501, 0.5],
      [0.502, 0.501],
      [0.503, 0.5],
    ]
    expect(finishStroke(twitch, 1000, 1000, 1)).toBeNull()
  })

  test('a loop ending near its start is closed', () => {
    const mark = finishStroke(ring(40), 1000, 1000, 1)
    expect(mark?.closed).toBe(true)
    expect(mark?.note).toBe('')
  })

  test('a straight line stays open', () => {
    const line: UV[] = Array.from({ length: 10 }, (_, i) => [
      0.1 + i * 0.05,
      0.5,
    ])
    expect(finishStroke(line, 1000, 1000, 1)?.closed).toBe(false)
  })
})
