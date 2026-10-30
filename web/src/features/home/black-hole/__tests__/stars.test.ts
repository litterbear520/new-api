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
import { describe, expect, it } from 'vitest'

import {
  CELL_N,
  LIST_W,
  type StarLists,
  buildStars,
  faintest,
  gunzipped,
  unpackStars,
} from '../stars'

type Star = { dir: [number, number, number]; mag: number; bv: number }

/** Packs stars the way the prototype's tools/pack_stars.py does (as part of `sky`: 'STR2') */
function pack(stars: Star[], bits = 14, sky?: Star[]) {
  const top = 2 ** bits - 1
  const coded = stars.map((s) => {
    const [x, y, z] = s.dir
    const l = Math.abs(x) + Math.abs(y) + Math.abs(z)
    let px = x / l
    let py = y / l
    if (z < 0) {
      const ox = px
      px = (1 - Math.abs(py)) * (ox >= 0 ? 1 : -1)
      py = (1 - Math.abs(ox)) * (py >= 0 ? 1 : -1)
    }
    const qx = Math.round((px * 0.5 + 0.5) * top)
    const qy = Math.round((py * 0.5 + 0.5) * top)
    let code = 0
    for (let i = 0; i < bits; i++) {
      code |= ((qx >> i) & 1) << (2 * i)
      code |= ((qy >> i) & 1) << (2 * i + 1)
    }
    return {
      code,
      mag: Math.round((s.mag + 2) * 20),
      bv: Math.round((s.bv + 0.5) * 80),
    }
  })
  coded.sort((a, b) => a.code - b.code)
  const bytes: number[] = [...(sky ? 'STR2' : 'STR1')].map((c) =>
    c.charCodeAt(0)
  )
  const u32 = (v: number) =>
    bytes.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255)
  u32(coded.length)
  u32(bits)
  if (sky) {
    const counts = Array.from({ length: 256 }, () => 0)
    for (const st of sky) counts[Math.round((st.mag + 2) * 20)]++
    counts.forEach(u32)
  }
  let prev = 0
  for (const c of coded) {
    let d = c.code - prev
    prev = c.code
    do {
      const b = d & 0x7f
      d >>>= 7
      bytes.push(d ? b | 0x80 : b)
    } while (d)
  }
  for (const c of coded) bytes.push(c.mag)
  for (const c of coded) bytes.push(c.bv)
  return new Uint8Array(bytes).buffer
}

const norm = (v: [number, number, number]): [number, number, number] => {
  const l = Math.hypot(...v)
  return [v[0] / l, v[1] / l, v[2] / l]
}
const STARS = [
  { dir: norm([1, 0.2, 0.1]), mag: 1.5, bv: 0.6 },
  { dir: norm([-0.3, 0.9, -0.4]), mag: 6.2, bv: -0.1 },
  { dir: norm([0.1, -0.2, -1]), mag: 8.9, bv: 1.4 },
]
const DESKTOP = (2 * Math.tan(Math.PI / 6)) / 1440

describe('the star pack', () => {
  it('unpacks directions to well under a pixel, and the magnitudes and colours', () => {
    const out = unpackStars(pack(STARS))
    expect(out.n).toBe(3)
    for (const s of STARS) {
      const found = [0, 1, 2].some((k) => {
        const d =
          out.dirs[k * 3] * s.dir[0] +
          out.dirs[k * 3 + 1] * s.dir[1] +
          out.dirs[k * 3 + 2] * s.dir[2]
        // 60 arcseconds; a pixel on a 1440 px screen is about 100
        return (
          Math.acos(Math.min(1, d)) < 60 / 206265 &&
          out.mag[k] === Math.round((s.mag + 2) * 20)
        )
      })
      expect(found).toBe(true)
    }
  })

  it('refuses what is not a pack', () => {
    expect(() => unpackStars(new Uint8Array(16).buffer)).toThrow(
      /not a star pack/
    )
  })

  it('passes an unzipped pack through as it is', async () => {
    const raw = pack(STARS)
    expect(await gunzipped(raw)).toBe(raw)
  })
})

/** A star as listed: where it is, its radius (CSS px), colour (display) and group */
type Listing = { dir: number[]; r: number; rgb: number[]; group: number }

/** Every listing in the built lists (a star is listed once for each cell its light reaches) */
function listings(lists: StarLists): Listing[] {
  let n = 0
  for (const e of lists.index) n += e & 31
  const { list } = lists
  return Array.from({ length: n }, (_, at) => {
    const o = at * 8
    return {
      dir: [list[o], list[o + 1], list[o + 2]],
      r: list[o + 3],
      rgb: [list[o + 4], list[o + 5], list[o + 6]],
      group: Math.floor(list[o + 7] / 10),
    }
  })
}
/** The stars in the lists, each once: the twinkling ones, the faint, the deep; biggest first in each */
const starsIn = (lists: StarLists): Listing[] =>
  [...new Map(listings(lists).map((l) => [l.dir.join(), l])).values()].sort(
    (a, b) => a.group - b.group || b.r - a.r
  )

/** The night sea's tints (display): blue-white, warm, white */
const BLUE = [196, 214, 255]
const WARM = [255, 238, 220]
const WHITE = [238, 241, 250]
/** Whether a colour is a tint at some opacity: its channels in the tint's proportions */
const isTint = (rgb: number[], tint: number[]): boolean =>
  rgb.every((c, i) => Math.abs(c / rgb[2] - tint[i] / tint[2]) < 1e-3)

const SKY = [
  { dir: norm([1, 0.2, 0.1]), mag: 1.5, bv: 0.6 },
  { dir: norm([-0.3, 0.9, -0.4]), mag: 4, bv: -0.1 },
  { dir: norm([0.2, -0.9, 0.3]), mag: 6.2, bv: 1.6 },
  { dir: norm([0.1, -0.2, -1]), mag: 8.9, bv: 0.6 },
]

describe('the star lists', () => {
  it('lays out an index entry for every cell and a list LIST_W texels wide', () => {
    const lists = buildStars(unpackStars(pack(SKY)), {
      smax: 7.6,
      perPx: DESKTOP,
    })
    expect(lists.index.length).toBe(6 * CELL_N * CELL_N)
    expect(lists.list.length).toBe(LIST_W * lists.rows * 4)
  })

  it("paints a star of part of the sky (the first screen's) as it is in the whole sky", () => {
    const look = { smax: 7.6, perPx: DESKTOP }
    const whole = starsIn(buildStars(unpackStars(pack(SKY)), look))
    // the second and fourth stars left out: the others keep their size and colour
    const part = starsIn(
      buildStars(unpackStars(pack([SKY[0], SKY[2]], 14, SKY)), look)
    )
    expect(part).toHaveLength(2)
    for (const star of part) {
      const same = whole.find((w) => w.dir.join() === star.dir.join())
      expect(same).toBeDefined()
      if (!same) continue
      expect(star.r).toBeCloseTo(same.r, 5)
      star.rgb.forEach((c, i) => expect(c).toBeCloseTo(same.rgb[i], 5))
    }
  })

  it("paints the brightest star that shows biggest and the dimmest at the night sea's .3 px", () => {
    const [brightest, , dimmest] = starsIn(
      buildStars(unpackStars(pack(SKY)), { smax: 7.6, perPx: DESKTOP })
    )
    expect(brightest.r).toBeCloseTo(2, 5)
    expect(dimmest.r).toBeCloseTo(0.3, 5)
  })

  it('lets the big stars twinkle and shows the small ones more where you look', () => {
    const [brightest, , dimmest] = starsIn(
      buildStars(unpackStars(pack(SKY)), { smax: 7.6, perPx: DESKTOP })
    )
    expect(brightest.group).toBe(0)
    expect(dimmest.group).toBe(1)
  })

  it('makes them bigger and brighter by size and gain, never past fully opaque', () => {
    const [brightest] = starsIn(
      buildStars(unpackStars(pack(SKY)), {
        smax: 7.6,
        perPx: DESKTOP,
        gain: 1.2,
        size: 1.25,
      })
    )
    expect(brightest.r).toBeCloseTo(2.5, 5)
    // white at full opacity
    brightest.rgb.forEach((c, i) => expect(c).toBeCloseTo(WHITE[i] / 255, 5))
  })

  it('keeps the stars past the faintest that show for where you look, small', () => {
    const deep = starsIn(
      buildStars(unpackStars(pack(SKY)), { smax: 7.6, perPx: DESKTOP })
    ).filter((s) => s.group === 2)
    expect(deep).toHaveLength(1)
    expect(deep[0].r).toBeGreaterThanOrEqual(0.3)
    expect(deep[0].r).toBeLessThanOrEqual(0.75)
  })

  it('tints them as the night sea does: the bluest blue-white, the reddest warm, the rest white', () => {
    const stars = starsIn(
      buildStars(unpackStars(pack(SKY)), { smax: 7.6, perPx: DESKTOP })
    )
    // the colour of the star (among those that show) with this B-V
    const colour = (bv: number) => {
      const sky = SKY.find((s) => s.bv === bv && s.mag < 7)
      const star = stars.find((s) =>
        s.dir.every((v, i) => Math.abs(v - (sky?.dir[i] ?? 9)) < 1e-3)
      )
      expect(star).toBeDefined()
      return star?.rgb ?? []
    }
    expect(isTint(colour(-0.1), BLUE)).toBe(true)
    expect(isTint(colour(1.6), WARM)).toBe(true)
    expect(isTint(colour(0.6), WHITE)).toBe(true)
  })

  it('lists a star with a halo in the cells round it, a small one only in its own', () => {
    // both in the middle of a cell (a cell is 2 / 256 of a cube face across)
    const c = 1 / CELL_N
    const lists = buildStars(
      unpackStars(
        pack([
          { dir: norm([1, c, c]), mag: 1, bv: 0.6 },
          { dir: norm([c, 1, c]), mag: 6, bv: 0.6 },
        ])
      ),
      { smax: 7.6, perPx: DESKTOP, dpr: 2 }
    )
    const cellsOf = (r: number) =>
      listings(lists).filter((l) => Math.abs(l.r - r) < 1e-6).length
    expect(cellsOf(2)).toBeGreaterThan(1)
    expect(cellsOf(0.3)).toBe(1)
  })

  it('shows fewer stars where a pixel holds more sky (a phone)', () => {
    const phone = (2 * Math.tan((40 * Math.PI) / 360)) / 390
    expect(faintest(8.6, DESKTOP)).toBeCloseTo(8.6)
    expect(faintest(8.6, phone)).toBeLessThan(7.5)
  })
})
