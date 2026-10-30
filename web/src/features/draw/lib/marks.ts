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
import type { MarkStroke } from '../types'

/* Marks are free-hand strokes in picture coordinates (0–1). A tap becomes a
   numbered pin; a loop gets its number near its top-left. */

const MARK_RED = '#FF3B30'

type Box = [number, number, number, number]

export function strokeBox(stroke: MarkStroke): Box {
  return stroke.reduce<Box>(
    (b, [u, v]) => [
      Math.min(b[0], u),
      Math.min(b[1], v),
      Math.max(b[2], u),
      Math.max(b[3], v),
    ],
    [1, 1, 0, 0]
  )
}

export function isTap(stroke: MarkStroke): boolean {
  const b = strokeBox(stroke)
  return b[2] - b[0] < 0.015 && b[3] - b[1] < 0.015
}

export function strokeCenter(stroke: MarkStroke): [number, number] {
  const b = strokeBox(stroke)
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]
}

export function pinPoint(stroke: MarkStroke): [number, number] {
  if (isTap(stroke)) return strokeCenter(stroke)
  const b = strokeBox(stroke)
  return [b[0] + (b[2] - b[0]) * 0.12, b[1] + (b[3] - b[1]) * 0.12]
}

/** SVG path data (0–100 box) for the glowing marks on the waiting fog. */
export function marksPath(marks: MarkStroke[]): string {
  return marks
    .filter((s) => !isTap(s))
    .map(
      (s) =>
        `M${s.map(([u, v]) => `${(u * 100).toFixed(2)} ${(v * 100).toFixed(2)}`).join('L')}`
    )
    .join('')
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strokes: MarkStroke[]
) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = MARK_RED
  ctx.lineWidth = Math.max(3, w * 0.007)
  for (const s of strokes) {
    if (isTap(s)) continue
    ctx.beginPath()
    s.forEach(([u, v], i) =>
      i ? ctx.lineTo(u * w, v * h) : ctx.moveTo(u * w, v * h)
    )
    ctx.stroke()
  }
  const r = Math.max(9, Math.min(w, h) * 0.022)
  strokes.forEach((s, i) => {
    const [u, v] = pinPoint(s)
    const cx = clamp(u * w, r + 2, w - r - 2)
    const cy = clamp(v * h, r + 2, h - r - 2)
    ctx.beginPath()
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = MARK_RED
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${Math.round(r * 1.15)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), cx, cy + r * 0.05)
  })
}
