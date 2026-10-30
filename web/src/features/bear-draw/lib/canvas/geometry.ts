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
import type { Camera, MarkState, Point, Rect, UV } from './types'

/* Pure maths of the canvas: layout, camera fitting, 圈选 strokes. */

export const MIN_S = 0.04
export const MAX_S = 4
export const ZOOM_STEPS = [
  0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4,
]
/** World units = picture pixels at 100%. */
export const LAY = {
  pad: 40,
  gap: 32,
  rowGap: 40,
  maxRowW: 5400,
  maxPerRow: 5,
  emptyW: 640,
  emptyH: 360,
  groupGap: 320,
  maxDisplayW: 1200,
}
/**
 * Screen px kept free when fitting: the top clears the page's bars and a
 * frame title, the bottom the tool bar.
 */
export const FIT = { side: 56, top: 96, bottom: 96 }
/** The page's bars cover the canvas down to here. */
export const BARS_BOTTOM = 60
export const MARK_RED = '#f04438'

export const clamp = (v: number, a: number, b: number) =>
  Math.min(b, Math.max(a, v))
export const mod = (a: number, n: number) => ((a % n) + n) % n
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

export function union(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  }
}

export type Size = { w: number; h: number }
export type FlowResult = { pos: Point[]; w: number; h: number }

/**
 * A frame's pictures in rows: at most five per row, a row wraps before it
 * gets wider than LAY.maxRowW. Positions are relative to the frame.
 */
export function flow(items: Size[]): FlowResult {
  const pos: Point[] = []
  let x = LAY.pad
  let y = LAY.pad
  let rowH = 0
  let count = 0
  let maxX = 0
  for (const it of items) {
    const full = x + it.w > LAY.maxRowW - LAY.pad || count >= LAY.maxPerRow
    if (count > 0 && full) {
      x = LAY.pad
      y += rowH + LAY.rowGap
      rowH = 0
      count = 0
    }
    pos.push({ x, y })
    x += it.w + LAY.gap
    rowH = Math.max(rowH, it.h)
    count++
    maxX = Math.max(maxX, x - LAY.gap)
  }
  if (!items.length) return { pos, w: LAY.emptyW, h: LAY.emptyH }
  return { pos, w: maxX + LAY.pad, h: y + rowH + LAY.pad }
}

/** Shown size: the user's width, else the picture's width up to 1200. */
export function dispSize(
  w: number,
  h: number,
  dw?: number | null
): [number, number] {
  const d = dw || Math.min(w, LAY.maxDisplayW)
  return [d, (d * h) / w]
}

/** The camera that shows `r` in a W×H view, at most at `maxS` (default 1). */
export function fitCamera(
  r: Rect,
  W: number,
  H: number,
  maxS?: number | null
): Camera {
  const aw = Math.max(80, W - FIT.side * 2)
  const ah = Math.max(80, H - FIT.top - FIT.bottom)
  const fitS = Math.min(aw / Math.max(1, r.w), ah / Math.max(1, r.h))
  const s = clamp(Math.min(fitS, maxS ?? 1), MIN_S, MAX_S)
  return {
    s,
    x: FIT.side + aw / 2 - (r.x + r.w / 2) * s,
    y: FIT.top + ah / 2 - (r.y + r.h / 2) * s,
  }
}

export const zoomStepUp = (s: number) =>
  ZOOM_STEPS.find((v) => v > s * 1.001) ?? MAX_S
export const zoomStepDown = (s: number) =>
  [...ZOOM_STEPS].reverse().find((v) => v < s * 0.999) ?? MIN_S

/** SVG path through the points (viewBox 1000 × vh), smoothed with quads. */
export function pathD(pts: UV[], closed: boolean, vh: number): string {
  if (!pts.length) return ''
  const P = pts.map(([u, v]): UV => [u * 1000, v * vh])
  const f = (n: number) => n.toFixed(1)
  let d = `M${f(P[0][0])} ${f(P[0][1])}`
  for (let i = 1; i < P.length - 1; i++) {
    const mx = (P[i][0] + P[i + 1][0]) / 2
    const my = (P[i][1] + P[i + 1][1]) / 2
    d += `Q${f(P[i][0])} ${f(P[i][1])} ${f(mx)} ${f(my)}`
  }
  const last = P.at(-1) ?? P[0]
  d += `L${f(last[0])} ${f(last[1])}`
  return closed ? `${d}Z` : d
}

/** Where a mark's number badge sits: its top-left corner. */
export function markAnchor(pts: UV[]): UV {
  let u0 = 1
  let v0 = 1
  for (const [u, v] of pts) {
    u0 = Math.min(u0, u)
    v0 = Math.min(v0, v)
  }
  return [u0, v0]
}

/**
 * A finished stroke on a picture shown dw × dh at scale s: thinned to
 * points ≥3 screen px apart, closed when it ends near its start. Null when
 * it is too small to be a mark (a click or a twitch).
 */
export function finishStroke(
  pts: UV[],
  dw: number,
  dh: number,
  s: number
): MarkState | null {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const [u, v] of pts) {
    minX = Math.min(minX, u)
    minY = Math.min(minY, v)
    maxX = Math.max(maxX, u)
    maxY = Math.max(maxY, v)
  }
  const bw = (maxX - minX) * dw
  const bh = (maxY - minY) * dh
  if (pts.length < 4 || Math.max(bw, bh) * s < 10) return null
  const start = pts[0]
  const end = pts.at(-1) ?? start
  const gap = Math.hypot((end[0] - start[0]) * dw, (end[1] - start[1]) * dh)
  const diag = Math.hypot(bw, bh)
  const keep: UV[] = [start]
  for (let i = 1; i < pts.length; i++) {
    const a = keep.at(-1) ?? start
    const b = pts[i]
    const far = Math.hypot((b[0] - a[0]) * dw, (b[1] - a[1]) * dh) * s >= 3
    if (far || i === pts.length - 1) {
      keep.push([Number(b[0].toFixed(4)), Number(b[1].toFixed(4))])
    }
  }
  return {
    pts: keep,
    closed: gap < Math.max(0.28 * diag, 12 / s),
    note: '',
  }
}
