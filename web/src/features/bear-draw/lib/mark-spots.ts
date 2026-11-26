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
import type { MarkInfo } from './canvas/types'

export type Spot = { n: number; x: number; y: number }

/**
 * Where each red mark sits on a w × h picture: the centre of its outline,
 * in whole percent. The planner reads it as words; the picture with the
 * marks drawn on it stays the guide for the image model.
 */
export function markSpots(marks: MarkInfo[], w: number, h: number): Spot[] {
  if (!(w > 0 && h > 0)) return []
  return marks.flatMap((m) => {
    if (!m.points.length) return []
    const xs = m.points.map((p) => p[0])
    const ys = m.points.map((p) => p[1])
    const pct = (lo: number, hi: number, size: number) =>
      Math.round(Math.min(100, Math.max(0, ((lo + hi) / 2 / size) * 100)))
    return [
      {
        n: m.n,
        x: pct(Math.min(...xs), Math.max(...xs), w),
        y: pct(Math.min(...ys), Math.max(...ys), h),
      },
    ]
  })
}

function third(v: number, names: [string, string, string]): string {
  if (v < 34) return names[0]
  return v > 66 ? names[2] : names[1]
}

/** "1 upper right (68% across, 18% down); 2 centre (50% across, 52% down)". */
export function spotsText(spots: Spot[]): string {
  return spots
    .map((s) => {
      const row = third(s.y, ['upper', 'middle', 'lower'])
      const col = third(s.x, ['left', 'centre', 'right'])
      const where =
        row === 'middle' && col === 'centre' ? 'centre' : `${row} ${col}`
      return `${s.n} ${where} (${s.x}% across, ${s.y}% down)`
    })
    .join('; ')
}
