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
/**
 * Refraction for liquid glass: how far in from the edge each pixel of a pane
 * shows the page. The result feeds an SVG feDisplacementMap. Two rims: the
 * curve measured on the real macOS Dock, and a convex squircle bevel (after
 * kube.io/blog/liquid-glass-css-svg): light comes straight down, bends once
 * on entering the glass (Snell's law), and lands further in, so the rim shows
 * a squeezed copy of what lies under the middle.
 */

const REFRACTIVE_INDEX = 1.5

/** Bevel height at x, from 0 at the outer edge to 1 where the top is flat. */
function bevel(x: number) {
  return Math.pow(1 - Math.pow(1 - x, 4), 1 / 4)
}

/**
 * How far sideways light lands after entering the bevel at x, in glass
 * thicknesses. `steepness` is the thickness divided by the bevel width.
 */
export function bend(x: number, steepness: number) {
  if (x <= 0 || x >= 1) return 0
  const step = 1e-3
  const from = Math.max(x - step, 0)
  const to = Math.min(x + step, 1)
  const slope = ((bevel(to) - bevel(from)) / (to - from)) * steepness
  const incidence = Math.atan(slope)
  const refraction = Math.asin(Math.sin(incidence) / REFRACTIVE_INDEX)
  return bevel(x) * Math.tan(incidence - refraction)
}

/** How far, in px, a pane shows the page further in, `depth` px from its edge. */
export type Rim = (depth: number) => number

/** A convex bevel `width` px wide on glass `thickness` px thick. */
export function convexRim(width: number, thickness: number): Rim {
  return (depth) => bend(depth / width, thickness / width) * thickness
}

/** The Dock, measured at 75px high: 20px at the edge, gone 12px in. */
const DOCK = { height: 75, band: 12, most: 20, power: 1.9 }

/** The Dock's rim on a pane `height` px high: the middle does not move at all. */
export function dockRim(height: number): Rim {
  const size = height / DOCK.height
  const band = DOCK.band * size
  const most = DOCK.most * size
  return (depth) =>
    depth <= 0 || depth >= band
      ? 0
      : most * Math.pow(1 - depth / band, DOCK.power)
}

/** Distance in from the edge of a rounded rectangle, and the way in. */
function inward(x: number, y: number, halfW: number, halfH: number, r: number) {
  const signX = Math.sign(x) || 1
  const signY = Math.sign(y) || 1
  const cornerX = Math.abs(x) - (halfW - r)
  const cornerY = Math.abs(y) - (halfH - r)
  if (cornerX > 0 && cornerY > 0) {
    const reach = Math.hypot(cornerX, cornerY)
    return {
      depth: r - reach,
      dx: (-signX * cornerX) / reach,
      dy: (-signY * cornerY) / reach,
    }
  }
  const toSide = halfW - Math.abs(x)
  const toEnd = halfH - Math.abs(y)
  return toSide < toEnd
    ? { depth: toSide, dx: -signX, dy: 0 }
    : { depth: toEnd, dx: 0, dy: -signY }
}

export type GlassPane = {
  width: number
  height: number
  radius: number
  rim: Rim
}

export type RefractionMap = {
  width: number
  height: number
  /** RGBA pixels: red and green carry the x and y shift, 128 for none. */
  pixels: Uint8ClampedArray<ArrayBuffer>
  /** feDisplacementMap scale: a channel at 255 shifts by half of it. */
  scale: number
}

export function refractionMap(pane: GlassPane): RefractionMap {
  const width = Math.max(1, Math.round(pane.width))
  const height = Math.max(1, Math.round(pane.height))
  const radius = Math.min(pane.radius, width / 2, height / 2)
  const shifts = new Float32Array(width * height * 2)
  let most = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = inward(
        x + 0.5 - width / 2,
        y + 0.5 - height / 2,
        width / 2,
        height / 2,
        radius
      )
      const shift = pane.rim(at.depth)
      const i = (y * width + x) * 2
      shifts[i] = at.dx * shift
      shifts[i + 1] = at.dy * shift
      most = Math.max(most, shift)
    }
  }
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = 128 + (most ? (shifts[i * 2] / most) * 127 : 0)
    pixels[i * 4 + 1] = 128 + (most ? (shifts[i * 2 + 1] / most) * 127 : 0)
    pixels[i * 4 + 2] = 128
    pixels[i * 4 + 3] = 255
  }
  return { width, height, pixels, scale: most * 2 }
}
