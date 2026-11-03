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
import { describe, expect, it } from 'vitest'

import {
  bend,
  convexRim,
  dockRim,
  refractionMap,
  type RefractionMap,
} from '../liquid-glass'

const pill = { width: 160, height: 40, radius: 20, rim: convexRim(14, 22) }

/** The x and y shift a map gives one pixel, from -127 to 127. */
function shiftAt(map: RefractionMap, x: number, y: number) {
  const i = (y * map.width + x) * 4
  return { x: map.pixels[i] - 128, y: map.pixels[i + 1] - 128 }
}

describe('bend', () => {
  it('leaves the flat top and the very edge straight', () => {
    expect(bend(1, 1.5)).toBe(0)
    expect(bend(0, 1.5)).toBe(0)
  })

  it('bends light most near the edge and less further in', () => {
    expect(bend(0.1, 1.5)).toBeGreaterThan(bend(0.3, 1.5))
    expect(bend(0.3, 1.5)).toBeGreaterThan(bend(0.8, 1.5))
  })
})

describe('refractionMap', () => {
  const map = refractionMap(pill)

  it('leaves the middle of the pane unbent', () => {
    expect(shiftAt(map, 80, 20)).toEqual({ x: 0, y: 0 })
  })

  it('shows what lies further in at every edge', () => {
    expect(shiftAt(map, 80, 1).y).toBeGreaterThan(0)
    expect(shiftAt(map, 80, 1).x).toBe(0)
    expect(shiftAt(map, 80, 38).y).toBeLessThan(0)
    expect(shiftAt(map, 1, 20).x).toBeGreaterThan(0)
    expect(shiftAt(map, 158, 20).x).toBeLessThan(0)
  })

  it('spends the full channel range on the largest shift', () => {
    const shifts = Array.from({ length: map.width * map.height }, (_, i) =>
      Math.max(
        Math.abs(map.pixels[i * 4] - 128),
        Math.abs(map.pixels[i * 4 + 1] - 128)
      )
    )
    expect(Math.max(...shifts)).toBe(127)
    expect(map.scale).toBeGreaterThan(0)
  })
})

describe('dockRim', () => {
  it('is the curve measured on the 75px Dock: 20px at the edge, gone 12px in', () => {
    const rim = dockRim(75)

    expect(rim(0.001)).toBeCloseTo(20, 1)
    expect(rim(6)).toBeCloseTo(5.36, 2)
    expect(rim(12)).toBe(0)
    expect(rim(30)).toBe(0)
  })

  it('scales with the pane: 6.4px wide and 10.7px at most on the 40px bar', () => {
    const rim = dockRim(40)

    expect(rim(0.001)).toBeCloseTo(10.67, 1)
    expect(rim(6.3)).toBeGreaterThan(0)
    expect(rim(6.4)).toBe(0)
  })

  it('leaves the outside of the pane alone', () => {
    expect(dockRim(40)(0)).toBe(0)
    expect(dockRim(40)(-3)).toBe(0)
  })
})

describe('refractionMap with the Dock rim', () => {
  const bar = { width: 161, height: 40, radius: 12, rim: dockRim(40) }
  const map = refractionMap(bar)

  it('moves nothing past the 6.4px band along its edges', () => {
    for (let x = 12; x < 149; x++) {
      for (let y = 7; y < 33; y++) {
        expect(shiftAt(map, x, y)).toEqual({ x: 0, y: 0 })
      }
    }
  })

  it('moves nothing past the band inside a corner', () => {
    // 5px from the corner's centre on the diagonal, 7px in from its arc
    expect(shiftAt(map, 8, 8)).toEqual({ x: 0, y: 0 })
  })

  it('bends the corner itself towards the middle', () => {
    expect(shiftAt(map, 5, 5).x).toBeGreaterThan(0)
    expect(shiftAt(map, 5, 5).y).toBeGreaterThan(0)
  })

  it('bends the top and the bottom alike', () => {
    for (let y = 0; y < 20; y++) {
      const top = shiftAt(map, 80, y)
      const bottom = shiftAt(map, 80, 39 - y)
      expect(top.x).toBe(0)
      expect(bottom.x).toBe(0)
      expect(Math.abs(top.y + bottom.y)).toBeLessThanOrEqual(1)
    }
    expect(shiftAt(map, 80, 0).y).toBeGreaterThan(0)
  })

  it('tells the filter how far the largest shift goes', () => {
    expect(map.scale).toBeGreaterThan(18)
    expect(map.scale).toBeLessThan(21.4)
  })
})
