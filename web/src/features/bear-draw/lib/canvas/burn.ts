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
import type { MarkRec } from './context'
import { clamp, MARK_RED } from './geometry'

/*
 * 完成圈选: the picture with its red marks and numbered badges drawn on,
 * at most 2048 px on the long side, as a PNG data URL for the model.
 */

export type Burned = { dataUrl: string | null; marksOnly: boolean }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (/^https?:/i.test(src) && !src.startsWith(location.origin)) {
      img.crossOrigin = 'anonymous'
    }
    img.addEventListener('load', () => resolve(img), { once: true })
    img.addEventListener(
      'error',
      () => reject(new Error('The picture could not be loaded')),
      { once: true }
    )
    img.src = src
  })
}

function drawMarks(
  x: CanvasRenderingContext2D,
  marks: MarkRec[],
  cw: number,
  ch: number
) {
  const L = Math.max(cw, ch)
  const lw = Math.max(3, L / 170)
  x.lineCap = 'round'
  x.lineJoin = 'round'
  for (const m of marks) {
    x.beginPath()
    m.pts.forEach(([u, v], i) => {
      if (i) x.lineTo(u * cw, v * ch)
      else x.moveTo(u * cw, v * ch)
    })
    if (m.closed) x.closePath()
    x.strokeStyle = 'rgba(255,255,255,.85)'
    x.lineWidth = lw * 2.2
    x.stroke()
    x.strokeStyle = MARK_RED
    x.lineWidth = lw
    x.stroke()
  }
  const R = Math.max(12, L / 42)
  for (const m of marks) {
    const bx = clamp(m.ax * cw, R + 2, cw - R - 2)
    const by = clamp(m.ay * ch, R + 2, ch - R - 2)
    x.beginPath()
    x.arc(bx, by, R, 0, Math.PI * 2)
    x.fillStyle = MARK_RED
    x.fill()
    x.lineWidth = Math.max(2, R / 6)
    x.strokeStyle = '#fff'
    x.stroke()
    x.fillStyle = '#fff'
    x.font = `600 ${Math.round(R * 1.15)}px -apple-system, "PingFang SC", sans-serif`
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillText(String(m.n), bx, by + R * 0.06)
  }
}

export async function burnMarks(
  src: string | null,
  w: number,
  h: number,
  marks: MarkRec[]
): Promise<Burned> {
  const k = Math.min(1, 2048 / Math.max(w, h))
  const cw = Math.round(w * k)
  const ch = Math.round(h * k)
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const x = canvas.getContext('2d')
  if (!x) return { dataUrl: null, marksOnly: true }
  let marksOnly = false
  try {
    const img = await loadImage(src ?? '')
    x.drawImage(img, 0, 0, cw, ch)
    // Throws when the picture came from another site (tainted canvas).
    x.getImageData(0, 0, 1, 1)
  } catch {
    marksOnly = true
    x.clearRect(0, 0, cw, ch)
  }
  drawMarks(x, marks, cw, ch)
  return { dataUrl: canvas.toDataURL('image/png'), marksOnly }
}
