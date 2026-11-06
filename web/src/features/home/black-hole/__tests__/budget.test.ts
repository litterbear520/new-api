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
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { GEOM, RING } from '../shaders'

const tex = join(import.meta.dirname, '../tex')
const size = (file: string) => statSync(join(tex, file)).size

// The home must not load or start slower than the one it replaced (11-05, measured on an Intel UHD 730)
describe('the first screen stays within its budget', () => {
  it.each([
    ['hole-desktop.avif', 69351],
    ['hole-desktop.webp', 104178],
    ['hole-phone.avif', 42640],
    ['hole-phone.webp', 60406],
    ['hole-desktop-soft.webp', 148],
    ['hole-phone-soft.webp', 146],
    ['sky-round-hole.webp', 30000],
  ])('%s is at most %d bytes', (file, bytes) => {
    expect(size(file)).toBeLessThanOrEqual(bytes)
  })

  it('leaves the heavy work out of the shader Direct3D compiles on its main thread', () => {
    // four outputs: compiled at the first draw, which stalls the GPU process
    expect(GEOM).toContain('layout(location=3) out')
    // the sky's noise is made ahead of time, the photon ring's rays compile in the background
    expect(GEOM).not.toContain('fbm')
    expect(GEOM).not.toContain('i<12')
    expect(RING).toContain('i<12')
    expect(RING).not.toContain('layout(location=1)')
  })

  it('reads the sky picture from its top row down', () => {
    expect(GEOM).toContain('-dot(d,gU)')
    expect(
      readFileSync(join(tex, 'sky-round-hole.webp')).subarray(8, 12).toString()
    ).toBe('WEBP')
  })
})
