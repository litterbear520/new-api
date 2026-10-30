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
  BC,
  N1,
  NC,
  NCAM,
  NR,
  QC,
  QE1,
  QE2,
  buildLens,
  camTable,
  rowB,
} from '../lens'

const tables = buildLens()

describe('the lens tables', () => {
  it('turn rays far from the hole as weak gravity does', () => {
    // total deflection 2 Phi_p - pi against 2/b + 15 pi / (16 b^2) + 16 / (3 b^3) (units of the Schwarzschild radius)
    for (const i of [N1 - 1, N1 - 120, N1 - 200]) {
      const b = rowB(i, N1, QE1, true)
      const alpha = 2 * tables.sweep[N1 + i] - Math.PI
      const weak = 2 / b + (15 * Math.PI) / 16 / b ** 2 + 16 / (3 * b ** 3)
      expect(b).toBeGreaterThan(20)
      expect(Math.abs(alpha - weak) / weak).toBeLessThan(2e-3)
    }
  })

  it('wind rays round the hole without end near the photon sphere', () => {
    const near = tables.sweep[N1]
    const further = tables.sweep[N1 + 200]
    expect(near).toBeGreaterThan(further + 2)
    // taken rays turn ever further the closer they come to BC from inside too
    expect(tables.sweep[0]).toBeGreaterThan(tables.sweep[N1 - 1])
    expect(rowB(N1 - 1, N1, QC, false)).toBeLessThan(1e-3)
    expect(rowB(0, N1, QE1, true) - BC).toBeLessThan(1e-6)
  })

  it('bring rays that get away in to their closest approach, where u^3 - u^2 + 1/b^2 = 0', () => {
    for (const i of [0, 100, NR - 1]) {
      const b = rowB(i, NR, QE2, true)
      const up = tables.path[(NR + i) * NC + NC - 1]
      expect(Math.abs(up ** 3 - up ** 2 + 1 / b ** 2)).toBeLessThan(1e-6)
      // and start far away
      expect(tables.path[(NR + i) * NC]).toBe(0)
    }
  })

  it('place the camera on its ray as flat space would, far out', () => {
    const rows = camTable(1e6, new Float32Array(NCAM))
    for (const i of [0, 100, 300, NCAM - 1]) {
      expect(rows[i]).toBeCloseTo((i / (NCAM - 1)) * (Math.PI / 2), 5)
    }
    // nearer, a ray has turned a little further by the time it reaches the camera
    const near = camTable(40, new Float32Array(NCAM))
    expect(near[300]).toBeGreaterThan(rows[300])
  })
})
