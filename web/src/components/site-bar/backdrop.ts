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

/*
 * The glass is thin, so the words on it have to suit whatever passes under it.
 * This is the arithmetic of that: page-reader.ts reads the page, bar-ink.ts
 * applies what comes out of here to the bar.
 */

export type Rgb = readonly [number, number, number]
export type Ink = 'light' | 'dark'
export type Layer = { color: Rgb; alpha: number }

const channel = (value: number): number => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance, from 0 to 1. */
export function luminance(c: Rgb): number {
  return (
    0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2])
  )
}

/** WCAG contrast of two luminances, from 1 to 21. */
export function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** `over` laid over `under` at `alpha`. */
export function mix(under: Rgb, over: Rgb, alpha: number): Rgb {
  return [
    under[0] + (over[0] - under[0]) * alpha,
    under[1] + (over[1] - under[1]) * alpha,
    under[2] + (over[2] - under[2]) * alpha,
  ]
}

/**
 * The glass, one for each theme and the same whatever passes under it, so the
 * page shows through as it is: bright where it is bright, dark where it is dark.
 * Dark: measured on the Dock. Light: lighter than the Dock's own, which measures
 * [153, 153, 153] at .25 and reads too grey on our white pages. These are the
 * values in styles/site-bar.css.
 */
export const GLASS: Record<'light' | 'dark', Layer> = {
  light: { color: [246, 248, 251], alpha: 0.16 },
  dark: { color: [52, 61, 62], alpha: 0.29 },
}

/** A word keeps its colour for as long as it reads at least this well. */
const STILL_READS = 3

/** The colour for a word over these luminances (glass included). */
export function chooseInk(lums: readonly number[], was?: Ink): Ink {
  const mean = lums.reduce((a, b) => a + b, 0) / lums.length
  const white = contrast(1, mean)
  const black = contrast(0, mean)
  if (was === 'light' && white >= STILL_READS) return 'light'
  if (was === 'dark' && black >= STILL_READS) return 'dark'
  return white >= black ? 'light' : 'dark'
}

/** What shows through `layers`, listed from the top down. */
export function composite(layers: readonly Layer[], fallback: Rgb): Rgb {
  const out: [number, number, number] = [0, 0, 0]
  let left = 1
  for (const { color, alpha } of layers) {
    for (let i = 0; i < 3; i++) out[i] += color[i] * alpha * left
    left *= 1 - alpha
    if (left < 0.01) return out
  }
  for (let i = 0; i < 3; i++) out[i] += fallback[i] * left
  return out
}
