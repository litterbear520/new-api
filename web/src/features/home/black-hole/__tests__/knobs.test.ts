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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  BAR,
  BAR_GAP,
  FRAME,
  KNOBS,
  OWN_FRAME_QUERY,
  REACH_UP,
  holeDistance,
  isPhone,
  knobsFor,
  lookFrame,
  shadowAt,
} from '../knobs'

/** Laptops and desktops (16:9 and 16:10), tablets and wide windows */
const SCREENS: [number, number][] = [
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1920, 1080],
  [2560, 1440],
  [2560, 970],
  [3440, 1300],
  [820, 1180],
]

describe('the first screen', () => {
  it.each(SCREENS)('keeps the hole clear of the bar (%i x %i)', (w, h) => {
    const K = knobsFor(isPhone(w), false)
    // the top of the hole's light (its arc), CSS px: the hole is a share of the frame's width
    const arcTop = K.hy * h - REACH_UP * K.hr * lookFrame(w, h, K.hx, K.hy).w
    expect(arcTop).toBeGreaterThanOrEqual(BAR + BAR_GAP)
  })

  it('frames tall narrow screens as phones', () => {
    expect(isPhone(390)).toBe(true)
    expect(isPhone(640)).toBe(true)
    expect(isPhone(641)).toBe(false)
    expect(isPhone(844)).toBe(false)
  })

  it('stills the twinkle and the flow when less motion is asked for', () => {
    const K = knobsFor(false, true)
    expect(K.tw).toBe(0)
    expect(K.fl).toBe(0)
    expect(knobsFor(false, false).tw).toBeGreaterThan(0)
  })
})

describe('the frame the look is set in', () => {
  /** Where the hole's centre falls on the canvas (from the top left) */
  const holeOn = (w: number, h: number) => {
    const f = lookFrame(w, h, KNOBS.hx, KNOBS.hy)
    return {
      x: KNOBS.hx * f.w - f.x,
      y: KNOBS.hy * f.h - (f.h - h - f.y),
      f,
    }
  }

  it('is the canvas itself at its own shape', () => {
    expect(lookFrame(1900, 1000, KNOBS.hx, KNOBS.hy)).toEqual({
      w: 1900,
      h: 1000,
      x: 0,
      y: 0,
    })
  })

  it.each([
    [1440, 790],
    [1920, 960],
    [2560, 970],
    [3440, 1300],
    [1180, 740],
    [1280, 1024],
  ])('is cropped round the hole on a %i x %i screen', (w, h) => {
    const { x, y, f } = holeOn(w, h)
    expect(f.w / f.h).toBeCloseTo(FRAME)
    expect(f.w).toBeGreaterThanOrEqual(w)
    expect(f.h).toBeGreaterThanOrEqual(h)
    expect(x).toBeCloseTo(KNOBS.hx * w)
    expect(y).toBeCloseTo(KNOBS.hy * h)
  })

  it('is the canvas itself on a tablet held upright', () => {
    expect(lookFrame(820, 1180, KNOBS.hx, KNOBS.hy)).toEqual({
      w: 820,
      h: 1180,
      x: 0,
      y: 0,
    })
  })

  it('is the canvas itself where the window is, whatever the canvas', () => {
    // a window just past 6/5 with a scroll bar: the canvas just under it
    expect(lookFrame(1190, 1000, KNOBS.hx, KNOBS.hy, false).w).toBeCloseTo(1900)
    expect(lookFrame(1210, 1000, KNOBS.hx, KNOBS.hy, true).w).toBe(1210)
  })

  it('leaves the poster out where the CSS keeps the canvas’s own frame', () => {
    const ratio = OWN_FRAME_QUERY.replace('(max-aspect-ratio: ', '').replace(
      ')',
      ''
    )
    for (const file of [
      '../black-hole.css',
      '../../night-sea/hero-shell-html.ts',
    ]) {
      const text = readFileSync(resolve(import.meta.dirname, file), 'utf8')
      expect(text.replaceAll(' ', '')).toContain(`max-aspect-ratio:${ratio}`)
    }
  })

  it('is how the CSS crops the poster on computers', () => {
    const css = readFileSync(
      resolve(import.meta.dirname, '../black-hole.css'),
      'utf8'
    )
    const computers = css.slice(css.indexOf('@media (min-width: 641px)'))
    const m =
      /\.ns-sky-poster img \{\s*object-position: ([\d.]+)% ([\d.]+)%/.exec(
        computers
      )
    const percent = (share: number) => Math.round(share * 1000) / 10
    expect(m && [Number(m[1]), Number(m[2])]).toEqual([
      percent(KNOBS.hx),
      percent(KNOBS.hy),
    ])
  })
})

describe('the hole', () => {
  it('finds the distance at which its shadow looks a given size', () => {
    for (const ang of [0.02, 0.06, 0.12]) {
      expect(shadowAt(holeDistance(ang), 1.4)).toBeCloseTo(
        1.4 * Math.tan(ang),
        6
      )
    }
  })
})
