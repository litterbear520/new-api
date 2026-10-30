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
// The catalogue's stars, laid out for the sky shader: Hipparcos-2 stars brighter
// than 9th magnitude, each a dot as the night sea paints its stars (its size and
// opacity from how bright it is among the rest, its tint from B-V), sorted into
// cube-face cells that list every star whose light reaches them.
// Pure (no DOM, no GL): runs in a worker.

export const CELL_N = 256
/** Rows of the star list are this many texels wide */
export const LIST_W = 2048
/** A cell lists at most this many stars (5 bits in the index) */
const CELL_MAX = 31

const seed = (k: number) => {
  const s = Math.sin(k * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

export type StarPack = {
  n: number
  /** Unit directions (J2000), three a star */
  dirs: Float32Array
  /** (mag + 2) * 20 */
  mag: Uint8Array
  /** (B-V + .5) * 80 */
  bv: Uint8Array
  /**
   * How many stars of the whole sky have each magnitude byte: a star is
   * painted by its rank among them, and the pack may hold only part of the
   * sky (the first screen's)
   */
  sky: Uint32Array
}

export type StarLists = {
  /** 6N x N cells: start << 5 | count */
  index: Uint32Array
  /**
   * LIST_W x rows RGBA texels, two a star: (x, y, z, radius in CSS px), (tint
   * times opacity, display terms, group * 10 + phase); group 0 = bright (they
   * twinkle), 1 = faint (more where you look), 2 = deep (only where you look)
   */
  list: Float32Array
  rows: number
}

/**
 * The faintest star that shows before you look: `smax` on a 1440 px wide
 * screen with a 60 deg view. Where a CSS pixel holds more sky (a phone) fewer
 * stars show, so a screen holds about as many as the night sea's.
 * perPx = the sky (rad) a CSS pixel spans.
 */
export function faintest(smax: number, perPx: number): number {
  return Math.min(
    8.8,
    smax -
      (2 * Math.log10(perPx / ((2 * Math.tan(Math.PI / 6)) / 1440))) / 0.477
  )
}

/**
 * Reads the star pack (tools/pack_stars.py in the prototype), gunzipped:
 * 'STR1', n, bits (or 'STR2', n, bits and 256 uint32: the whole sky's stars
 * at each magnitude byte, for a pack of part of the sky); the directions as
 * octahedral coordinates along a Morton curve, as varint deltas; then a byte
 * column of magnitudes and one of colours.
 */
export function unpackStars(buf: ArrayBuffer): StarPack {
  const u8 = new Uint8Array(buf)
  const dv = new DataView(buf)
  const magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3])
  if (magic !== 'STR1' && magic !== 'STR2') {
    throw new Error('stars: not a star pack')
  }
  const n = dv.getUint32(4, true)
  const bits = dv.getUint32(8, true)
  if (bits > 15) throw new Error('stars: too many bits')
  const top = 2 ** bits - 1
  const dirs = new Float32Array(n * 3)
  let at = 12
  let sky: Uint32Array | null = null
  if (magic === 'STR2') {
    if (at + 1024 > u8.length) throw new Error('stars: pack cut short')
    sky = new Uint32Array(256)
    for (let m = 0; m < 256; m++) sky[m] = dv.getUint32(at + 4 * m, true)
    at += 1024
  }
  let code = 0
  for (let k = 0; k < n; k++) {
    let d = 0
    let shift = 1
    let b: number
    do {
      b = u8[at++]
      d += (b & 0x7f) * shift
      shift *= 128
    } while (b & 0x80)
    code += d
    // the two coordinates interleaved, x in the even bits (2 * bits < 31: int bit ops)
    let qx = 0
    let qy = 0
    for (let i = 0; i < bits; i++) {
      qx |= ((code >> (2 * i)) & 1) << i
      qy |= ((code >> (2 * i + 1)) & 1) << i
    }
    let ex = (qx / top) * 2 - 1
    let ey = (qy / top) * 2 - 1
    const ez = 1 - Math.abs(ex) - Math.abs(ey)
    const t = Math.max(-ez, 0)
    ex -= ex >= 0 ? t : -t
    ey -= ey >= 0 ? t : -t
    const l = Math.hypot(ex, ey, ez)
    dirs[k * 3] = ex / l
    dirs[k * 3 + 1] = ey / l
    dirs[k * 3 + 2] = ez / l
  }
  if (at + 2 * n > u8.length) throw new Error('stars: pack cut short')
  const mag = u8.slice(at, at + n)
  if (!sky) {
    // the whole sky
    sky = new Uint32Array(256)
    for (const m of mag) sky[m]++
  }
  return { n, dirs, mag, bv: u8.slice(at + n, at + 2 * n), sky }
}

function cellOf(x: number, y: number, z: number): number {
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  const az = Math.abs(z)
  let face: number
  let s: number
  let t: number
  if (ax >= ay && ax >= az) {
    face = x > 0 ? 0 : 1
    s = y / ax
    t = z / ax
  } else if (ay >= az) {
    face = y > 0 ? 2 : 3
    s = x / ay
    t = z / ay
  } else {
    face = z > 0 ? 4 : 5
    s = x / az
    t = y / az
  }
  const i = Math.min(
    CELL_N - 1,
    Math.max(0, Math.floor((s * 0.5 + 0.5) * CELL_N))
  )
  const j = Math.min(
    CELL_N - 1,
    Math.max(0, Math.floor((t * 0.5 + 0.5) * CELL_N))
  )
  return j * 6 * CELL_N + face * CELL_N + i
}

const COS8 = Array.from({ length: 8 }, (_, i) => Math.cos((i * Math.PI) / 4))
const SIN8 = Array.from({ length: 8 }, (_, i) => Math.sin((i * Math.PI) / 4))

export type StarLook = {
  /** The faintest that show before you look (on a 1440 px screen, see faintest()) */
  smax: number
  /** The sky a CSS pixel spans (rad), and device pixels to one */
  perPx: number
  dpr?: number
  /** Opacity and size, times the night sea's */
  gain?: number
  size?: number
}

/** The night sea's tints (display sRGB): blue-white, warm, white */
const TINTS = [
  [196, 214, 255],
  [255, 238, 220],
  [238, 241, 250],
]

/**
 * The stars painted as the night sea paints its own: round dots, sized by how
 * bright a star is among those that show before you look (u = its rank, 1 the
 * brightest): radius (.3 + 1.7 u^7) x size CSS px, opacity (.3 + .55 u^.7) x
 * gain, a soft halo five radii wide on the biggest (over 1.4 px: shaders.ts
 * starDot), the night sea's tints from B-V (under -.04 blue-white, over 1.49
 * warm: about a tenth of the shown stars each). Stars fainter than
 * faintest(smax) are its deep field: small, only where you look. Each is
 * listed in the cube-face cells its light reaches.
 */
export function buildStars(pack: StarPack, look: StarLook): StarLists {
  const { n, dirs, mag: mags, bv: bvs, sky } = pack
  const { perPx, dpr = 1, gain = 1, size = 1 } = look
  const SMAX = faintest(look.smax, perPx)
  const shown: number[] = []
  for (let k = 0; k < n; k++) if (mags[k] / 20 - 2 < SMAX) shown.push(k)
  shown.sort((a, b) => mags[a] - mags[b])
  // its rank among the whole sky's stars that show: those brighter, and its
  // place among those as bright (the pack's spread over the sky's)
  const brighter = new Float64Array(257)
  for (let m = 0; m < 256; m++) brighter[m + 1] = brighter[m] + sky[m]
  let all = 0
  for (let m = 0; m < 256; m++) if (m / 20 - 2 < SMAX) all += sky[m]
  const here = new Uint32Array(256)
  for (const k of shown) here[mags[k]]++
  const placed = new Uint32Array(256)
  const rank = new Float32Array(n).fill(-1)
  for (const k of shown) {
    const m = mags[k]
    const i = brighter[m] + (placed[m]++ * sky[m]) / here[m]
    rank[k] = 1 - i / Math.max(1, all - 1)
  }
  const t0 = new Float32Array(n * 4)
  const t1 = new Float32Array(n * 4)
  const cells: (number[] | undefined)[] = Array.from({
    length: 6 * CELL_N * CELL_N,
  })
  const seen = new Int32Array(17)
  for (let k = 0; k < n; k++) {
    const x = dirs[k * 3]
    const y = dirs[k * 3 + 1]
    const z = dirs[k * 3 + 2]
    const u = rank[k]
    const deep = u < 0
    // its own chance, by where it is: the same star the same in any pack
    const own = x * 4517.3 + y * 7793.9 + z * 3313.7
    const r = deep ? 0.3 + 0.45 * seed(own + 0.31) : (0.3 + 1.7 * u ** 7) * size
    const a = deep
      ? 0.3 + 0.5 * seed(own + 0.77)
      : Math.min(1, (0.3 + 0.55 * u ** 0.7) * gain)
    const bv = bvs[k] / 80 - 0.5
    let tint = TINTS[2]
    if (bv < -0.04) tint = TINTS[0]
    else if (bv > 1.49) tint = TINTS[1]
    let group = 1
    if (deep) group = 2
    else if (r > 0.95) group = 0
    t0.set([x, y, z, r], k * 4)
    t1.set(
      [
        (tint[0] / 255) * a,
        (tint[1] / 255) * a,
        (tint[2] / 255) * a,
        group * 10 + 0.1 + 6.1 * seed(own + 0.5),
      ],
      k * 4
    )
    // the cells its light reaches (the disc and a pixel round it, or its halo)
    const m = (3 / dpr + (r > 1.4 ? 5 * r : r + 1)) * perPx
    let p0 = -y
    let p1 = x
    let p2 = 0
    if (Math.abs(z) >= 0.9) {
      p0 = 0
      p1 = -z
      p2 = y
    }
    const pl = Math.hypot(p0, p1, p2)
    p0 /= pl
    p1 /= pl
    p2 /= pl
    const q0 = y * p2 - z * p1
    const q1 = z * p0 - x * p2
    const q2 = x * p1 - y * p0
    let ns = 0
    seen[ns++] = cellOf(x, y, z)
    for (let h = 0; h < 2; h++) {
      const mm = h ? m / 2 : m
      for (let i = 0; i < 8; i++) {
        const ca = COS8[i] * mm
        const sa = SIN8[i] * mm
        const id = cellOf(
          x + p0 * ca + q0 * sa,
          y + p1 * ca + q1 * sa,
          z + p2 * ca + q2 * sa
        )
        let dup = false
        for (let j = 0; j < ns; j++) if (seen[j] === id) dup = true
        if (!dup) seen[ns++] = id
      }
    }
    for (let j = 0; j < ns; j++) {
      const c = cells[seen[j]] ?? (cells[seen[j]] = [])
      if (c.length < CELL_MAX) c.push(k)
    }
  }
  const index = new Uint32Array(cells.length)
  let total = 0
  for (const c of cells) if (c) total += c.length
  const rows = Math.max(1, Math.ceil((total * 2) / LIST_W))
  const list = new Float32Array(LIST_W * rows * 4)
  let at = 0
  for (let id = 0; id < cells.length; id++) {
    const c = cells[id]
    if (!c) continue
    index[id] = (at << 5) | c.length
    for (const k of c) {
      list.set(t0.subarray(k * 4, k * 4 + 4), at * 8)
      list.set(t1.subarray(k * 4, k * 4 + 4), at * 8 + 4)
      at++
    }
  }
  return { index, list, rows }
}

/** The pack as fetched: gzip unless a server already undid it */
export async function gunzipped(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const u8 = new Uint8Array(buf, 0, 2)
  if (u8[0] !== 0x1f || u8[1] !== 0x8b) return buf
  const stream = new Blob([buf])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}
