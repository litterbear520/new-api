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

import { chimeWav } from '../alerts'

const text = (view: DataView, at: number, n: number) =>
  String.fromCodePoint(
    ...Array.from({ length: n }, (_, i) => view.getUint8(at + i))
  )

describe('chimeWav', () => {
  test('is a playable 16-bit mono PCM WAV', () => {
    const buf = chimeWav(true)
    const view = new DataView(buf)
    expect(text(view, 0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(buf.byteLength - 8)
    expect(text(view, 8, 4)).toBe('WAVE')
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint16(34, true)).toBe(16)
    expect(text(view, 36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(buf.byteLength - 44)
    const secs = (buf.byteLength - 44) / 2 / view.getUint32(24, true)
    expect(secs).toBeGreaterThan(0.9)
    expect(secs).toBeLessThan(1.2)
  })

  test('is soft but not silent, and the failure chime differs', () => {
    const peak = (buf: ArrayBuffer) => {
      const pcm = new Int16Array(buf, 44)
      return pcm.reduce((m, v) => Math.max(m, Math.abs(v)), 0) / 32767
    }
    const ok = chimeWav(true)
    const err = chimeWav(false)
    expect(peak(ok)).toBeGreaterThan(0.05)
    expect(peak(ok)).toBeLessThan(0.2)
    expect(peak(err)).toBeGreaterThan(0.05)
    expect(err.byteLength).not.toBe(ok.byteLength)
  })
})
