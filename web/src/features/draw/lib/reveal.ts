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
import type { CSSProperties } from 'react'

import { ratioAspect } from '../constants'
import type { DrawItem } from '../types'
import { strokeCenter } from './marks'

/*
 * The finished picture ripples out of one point: the boat for a new picture,
 * each circled spot (or the middle) for an edit. --p runs 0 → 1 in CSS; each
 * origin's radius is p × (distance to its farthest corner).
 */

export type SceneSize = 'big' | 'mid' | 'mini' | 'tiny'

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** Negative animation delay so loops keep their place across re-renders. */
export function phase(): CSSProperties {
  return {
    '--ph': `-${(performance.now() / 1000).toFixed(2)}s`,
  } as CSSProperties
}

export function revealOrigins(
  item: DrawItem,
  w: number,
  h: number,
  size: SceneSize
): Array<[number, number]> {
  const edit = item.req.imgs.some((img) => img.kind === 'base')
  const marks = item.req.marks
  if (edit) {
    if (!marks?.length) return [[w / 2, h / 2]]
    return marks.map((s) => {
      const [u, v] = strokeCenter(s)
      return [u * w, v * h]
    })
  }
  let boat = 46
  if (size === 'mini') boat = 22
  else if (size === 'tiny') boat = 17
  return [[w * 0.34 + boat / 2, h * 0.66 - boat * 0.15]]
}

export function revealStyles(
  origins: Array<[number, number]>,
  w: number,
  h: number
): { main: CSSProperties; rim: CSSProperties; ring: CSSProperties } {
  const k = clamp(Math.max(w, h) / 600, 0.3, 1)
  const radii = origins.map(
    ([x, y]) =>
      Math.max(
        Math.hypot(x, y),
        Math.hypot(w - x, y),
        Math.hypot(x, h - y),
        Math.hypot(w - x, h - y)
      ) +
      40 * k
  )
  const at = ([x, y]: [number, number]) =>
    `circle at ${x.toFixed(1)}px ${y.toFixed(1)}px`
  const px = (v: number) => `${(v * k).toFixed(1)}px`
  const each = (f: (a: string, r: string) => string) =>
    origins
      .map((o, i) => f(at(o), `var(--p) * ${Math.round(radii[i])}px`))
      .join(',')
  const main = each(
    (a, r) =>
      `radial-gradient(${a},#000 calc(${r} - ${px(36)}),transparent calc(${r}))`
  )
  const rim = each(
    (a, r) =>
      `radial-gradient(${a},transparent calc(${r} - ${px(50)}),#000 calc(${r} - ${px(28)}),#000 calc(${r} - ${px(10)}),transparent calc(${r} + ${px(8)}))`
  )
  const ring = each(
    (a, r) =>
      `radial-gradient(${a},transparent calc(${r} - ${px(5)}),rgb(240 246 255/.72) calc(${r} - ${px(1.5)}),rgb(150 190 255/0) calc(${r} + ${px(16)})),radial-gradient(${a},transparent calc(${r} * .7 - ${px(3)}),rgb(255 255 255/.3) calc(${r} * .7),transparent calc(${r} * .7 + ${px(10)}))`
  )
  return {
    main: { WebkitMaskImage: main, maskImage: main },
    rim: { WebkitMaskImage: rim, maskImage: rim },
    ring: { backgroundImage: ring },
  }
}

/** Seconds as m:ss. */
export function formatClock(secs: number): string {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

/** Expected size of a picture before it exists. */
export function itemAspect(item: DrawItem): [number, number] {
  if (item.img) return [item.img.w, item.img.h]
  const base = item.req.imgs.find((img) => img.kind === 'base')
  if (base && item.req.ratio === 'auto' && !item.req.clear) {
    return [base.w, base.h]
  }
  return ratioAspect(item.req.ratio, item.req.clear)
}
