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
 * The night sea behind the chat in dark mode: the homepage's canvas sky
 * ("your sea is so wide, my boat so small"), cut down for a busy page.
 * Stars seeded by tonight's date, a noise Milky Way with a dust lane rising
 * from the sea, the horizon glow, sea glints and star reflections; where the
 * pointer goes the sky shows a little more (reveal + spotlight). Added for
 * the chat: a meteor every 7–14 s, cross spikes on the seven brightest stars
 * and the lantern's golden path on the water below the bear's boat.
 * Draws at most 30 frames a second, and stops while hidden.
 */

type Star = {
  x: number
  y: number
  r: number
  a: number
  ti: number
  w: number
  ph: number
  spike: number
}
type Reflection = { x: number; dy: number; a: number; c: string; ph: number }
type Stroke = {
  x: number
  y: number
  l: number
  a: number
  w: number
  ph: number
}
type Glint = { q: number; dy: number; w: number; ph: number; f: number }
type Meteor = {
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
  len: number
}
type Band = {
  p0: { x: number; y: number }
  d: { x: number; y: number }
  n: { x: number; y: number }
  len: number
  sigma: number
}

export type NightSkyOptions = {
  /** Horizon as a fraction of the height, or a function giving it in px. */
  horizon: () => number
  /** The lantern in canvas pixels, or null when there is no boat. */
  lantern?: () => { x: number; y: number } | null
  still?: boolean
}

export type NightSky = {
  setStill: (still: boolean) => void
  /** Re-reads the size and horizon. */
  refresh: () => void
  dispose: () => void
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const TINTS = ['196,214,255', '255,238,220', '238,241,250']
const S = 4
const REST = 0.62
const TRAIL = 1.6
const FRAME_MS = 32

export function mountNightSky(
  cv: HTMLCanvasElement,
  opts: NightSkyOptions
): NightSky {
  const ctx = cv.getContext('2d')
  if (!ctx) {
    return {
      setStill: () => undefined,
      refresh: () => undefined,
      dispose: () => undefined,
    }
  }
  const g = ctx
  let still = opts.still ?? false
  const today = new Date()
  const nightSeed =
    today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  const mulberry = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  let rand = mulberry(nightSeed)
  const gauss = () =>
    Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand())
  const tintIndex = () => {
    const r = rand()
    if (r < 0.12) return 0
    return r < 0.2 ? 1 : 2
  }
  const hash = (ix: number, iy: number) => {
    let h =
      (Math.imul(ix, 374761393) +
        Math.imul(iy, 668265263) +
        Math.imul(nightSeed, 1442695041)) |
      0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    let fx = x - ix
    let fy = y - iy
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    const a = hash(ix, iy)
    const b = hash(ix + 1, iy)
    const c = hash(ix, iy + 1)
    const d = hash(ix + 1, iy + 1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
  const fbm = (x: number, y: number) => {
    let sum = 0
    let amp = 0.5
    let norm = 0
    for (let o = 0; o < 5; o++) {
      sum += amp * noise(x, y)
      norm += amp
      x = x * 2.03 + 17.1
      y = y * 2.03 + 9.2
      amp *= 0.5
    }
    return sum / norm
  }

  let W = 1
  let H = 1
  let dpr = 1
  let hz = 1
  let band: Band = {
    p0: { x: 0, y: 0 },
    d: { x: 0, y: 1 },
    n: { x: 1, y: 0 },
    len: 1,
    sigma: 1,
  }
  let warmth = 0
  let haze: HTMLCanvasElement
  let starLayer: HTMLCanvasElement
  let deep: HTMLCanvasElement
  let glow: HTMLCanvasElement
  let gw = 1
  let gh = 1
  let haloSprite: HTMLCanvasElement
  let reveal: HTMLCanvasElement
  let revealCtx: CanvasRenderingContext2D
  let mask: HTMLCanvasElement
  let maskCtx: CanvasRenderingContext2D
  let dab: HTMLCanvasElement
  let brightStars: Star[] = []
  let reflections: Reflection[] = []
  let strokes: Stroke[] = []
  let lampGlints: Glint[] = []
  let meteors: Meteor[] = []
  let nextMeteor = 0
  const lensR = 170
  const spotR = 300

  const milkyWay = (x: number, y: number) => {
    if (y >= hz) return 0
    const { p0, d, n, len, sigma } = band
    const rx = x - p0.x
    const ry = y - p0.y
    const t = (rx * d.x + ry * d.y) / len
    if (t < -0.15 || t > 1.2) return 0
    const bulge = Math.exp(-(((t - 0.04) / 0.16) ** 2))
    const u = (rx * n.x + ry * n.y) / (sigma * (1 + 0.4 * bulge))
    if (u > 3.4 || u < -3.4) return 0
    const body = Math.exp(-u * u * 0.5)
    const clouds = clamp01((fbm(t * 6 + 3.1, u * 1.2 + 7.7) - 0.3) / 0.4)
    const grain = fbm(t * 20 + 11, u * 3.8 + 2)
    let I =
      body *
      (0.35 + 0.75 * bulge + 0.25 * (1 - t)) *
      (0.2 + 1.1 * clouds * clouds) *
      (0.7 + 0.6 * grain)
    I += 0.45 * bulge * Math.exp(-u * u * 0.4)
    const laneAt =
      0.25 * Math.sin(t * 4.2 + 0.6) + 0.4 * (fbm(t * 3 + 40, 1.7) - 0.5)
    const lane =
      Math.exp(-(((u - laneAt) / 0.36) ** 2)) *
      (0.4 + 0.6 * fbm(t * 9 + 23, u * 2.2 + 5))
    I *= 1 - 0.82 * lane
    I *= 0.45 + 0.55 * clamp01((hz - y) / (H * 0.06))
    warmth = bulge
    return I
  }

  const layer = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
    const c = document.createElement('canvas')
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
    const x = c.getContext('2d') as CanvasRenderingContext2D
    x.scale(dpr, dpr)
    return [c, x]
  }

  function build() {
    rand = mulberry(nightSeed)
    const r = (cv.parentElement ?? cv).getBoundingClientRect()
    W = Math.max(1, Math.round(r.width))
    H = Math.max(1, Math.round(r.height))
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    hz = Math.max(40, Math.min(H - 8, Math.round(opts.horizon())))
    cv.width = Math.round(W * dpr)
    cv.height = Math.round(H * dpr)
    cv.style.width = `${W}px`
    cv.style.height = `${H}px`
    const area = Math.max((W * H) / (1440 * 900), 0.45)
    // the Milky Way rises from the sea on the right and climbs across the sky
    const p0 = { x: W * 0.7, y: hz + H * 0.03 }
    const p1 = { x: W * 1.02, y: -H * 0.36 }
    const len = Math.hypot(p1.x - p0.x, p1.y - p0.y)
    const d = { x: (p1.x - p0.x) / len, y: (p1.y - p0.y) / len }
    band = { p0, d, n: { x: -d.y, y: d.x }, len, sigma: Math.min(W, H) * 0.09 }
    const along = (t: number, s: number): [number, number] => [
      p0.x + d.x * t * len + band.n.x * s,
      p0.y + d.y * t * len + band.n.y * s,
    ]
    gw = Math.ceil(W / S)
    gh = Math.ceil(H / S)
    glow = document.createElement('canvas')
    glow.width = gw
    glow.height = gh
    const gctx = glow.getContext('2d') as CanvasRenderingContext2D
    const img = gctx.createImageData(gw, gh)
    for (let py = 0; py < gh; py++) {
      for (let px = 0; px < gw; px++) {
        const I = milkyWay(px * S + S / 2, py * S + S / 2)
        if (I < 0.004) continue
        const k = (py * gw + px) * 4
        img.data[k] = 196 + 46 * warmth
        img.data[k + 1] = 207 + 18 * warmth
        img.data[k + 2] = 238 - 38 * warmth
        img.data[k + 3] = Math.min(255, I * 0.3 * 255)
      }
    }
    gctx.putImageData(img, 0, 0)
    let v: CanvasRenderingContext2D
    ;[haze, v] = layer()
    v.imageSmoothingEnabled = true
    v.imageSmoothingQuality = 'high'
    v.drawImage(glow, 0, 0, gw * S, gh * S)
    const grains = Math.round(30000 * area)
    for (let i = 0; i < grains; i++) {
      const [x, y] = along(rand() * 1.15 - 0.05, gauss() * band.sigma * 1.2)
      if (x < 0 || x > W || y < 0) continue
      const a = milkyWay(x, y) * 0.16 * (0.3 + rand() * 1.2)
      if (a < 0.008) continue
      v.fillStyle = `rgba(216,222,242,${Math.min(a, 0.5).toFixed(3)})`
      v.fillRect(x, y, 1.1, 1.1)
    }
    brightStars = []
    reflections = []
    ;[starLayer, v] = layer()
    const sv = v
    const addStar = (
      x: number,
      y: number,
      r0: number,
      a0: number,
      ti: number
    ) => {
      if (y > hz - 2 || x < 0 || x > W || y < 0) return
      const a = a0 * (0.25 + 0.75 * clamp01((hz - y) / (H * 0.14)))
      if (r0 > 0.95) {
        brightStars.push({
          x,
          y,
          r: r0,
          a,
          ti,
          w: 0.6 + rand() * 1.8,
          ph: rand() * 6.3,
          spike: 0,
        })
      } else {
        sv.fillStyle = `rgba(${TINTS[ti]},${a.toFixed(3)})`
        sv.beginPath()
        sv.arc(x, y, r0, 0, 6.283)
        sv.fill()
      }
      if (r0 * a > 0.55 && hz - y < hz * 0.45) {
        reflections.push({
          x,
          dy: hz - y,
          a: r0 * a,
          c: TINTS[ti],
          ph: rand() * 6.3,
        })
      }
    }
    const bandStars = Math.round(2400 * area)
    for (let i = 0; i < bandStars; i++) {
      const [x, y] = along(rand() * 1.15 - 0.05, gauss() * band.sigma)
      if (rand() > milkyWay(x, y) * 0.9) continue
      addStar(x, y, 0.3 + rand() ** 5 * 0.95, 0.3 + rand() * 0.5, tintIndex())
    }
    const field = Math.round(1250 * area)
    for (let i = 0; i < field; i++) {
      addStar(
        rand() * W,
        rand() * hz,
        0.3 + rand() ** 7 * 1.8,
        0.22 + rand() * 0.62,
        tintIndex()
      )
    }
    // the brightest few get cross spikes
    brightStars.sort((a, b) => b.r * b.a - a.r * a.a)
    brightStars.forEach((s, i) => {
      s.spike = i < 7 ? 1 - i * 0.1 : 0
    })
    ;[deep, v] = layer()
    const deepCount = Math.round(5200 * area)
    for (let i = 0; i < deepCount; i++) {
      const [x, y] =
        rand() < 0.5
          ? along(rand() * 1.15 - 0.05, gauss() * band.sigma * 1.1)
          : [rand() * W, rand() * hz]
      if (y > hz - 2 || x < 0 || x > W || y < 0) continue
      const a =
        (0.3 + rand() * 0.5) * (0.25 + 0.75 * clamp01((hz - y) / (H * 0.14)))
      v.fillStyle = `rgba(${TINTS[tintIndex()]},${a.toFixed(3)})`
      v.beginPath()
      v.arc(x, y, 0.3 + rand() * 0.45, 0, 6.283)
      v.fill()
    }
    reveal = document.createElement('canvas')
    reveal.width = cv.width
    reveal.height = cv.height
    revealCtx = reveal.getContext('2d') as CanvasRenderingContext2D
    mask = document.createElement('canvas')
    mask.width = Math.ceil(W / S)
    mask.height = Math.ceil(H / S)
    maskCtx = mask.getContext('2d') as CanvasRenderingContext2D
    dab = document.createElement('canvas')
    dab.width = 128
    dab.height = 128
    const dctx = dab.getContext('2d') as CanvasRenderingContext2D
    const dg = dctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    dg.addColorStop(0, 'rgba(255,255,255,1)')
    dg.addColorStop(0.45, 'rgba(255,255,255,0.8)')
    dg.addColorStop(1, 'rgba(255,255,255,0)')
    dctx.fillStyle = dg
    dctx.fillRect(0, 0, 128, 128)
    strokes = []
    const seaDepth = H - hz
    const count = Math.round(
      1100 * Math.max(area, 0.5) * (seaDepth / (H * 0.26))
    )
    for (let i = 0; i < count; i++) {
      const q = rand() ** 1.8
      strokes.push({
        x: rand() * (W + 24) - 24,
        y: hz + 1.5 + q * seaDepth,
        l: 2 + q * 16 + rand() * 6 * q,
        a: (0.05 + rand() * 0.09) * (1 - 0.45 * q),
        w: 0.3 + rand() * 1.2,
        ph: rand() * 6.3,
      })
    }
    lampGlints = []
    for (let j = 0; j < 34; j++) {
      const q = (j + rand() * 0.9) / 34
      lampGlints.push({
        q,
        dy: 2 + q ** 1.7 * seaDepth * 0.9,
        w: 1 + q * 9 + rand() * 3 * q,
        ph: rand() * 6.3,
        f: 1.2 + rand() * 2.2,
      })
    }
    haloSprite = document.createElement('canvas')
    haloSprite.width = 64
    haloSprite.height = 64
    const h = haloSprite.getContext('2d') as CanvasRenderingContext2D
    const hg = h.createRadialGradient(32, 32, 0, 32, 32, 32)
    hg.addColorStop(0, 'rgba(236,240,252,1)')
    hg.addColorStop(1, 'rgba(236,240,252,0)')
    h.fillStyle = hg
    h.fillRect(0, 0, 64, 64)
  }

  // the pointer: where it is, the sky shows a little more; 1.6 s of afterglow
  const ptr = { x: 0, y: 0, inside: false }
  const cur = { x: 0, y: 0 }
  let presence = 0
  let trail: Array<{ x: number; y: number; t: number }> = []
  const onPointer = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect()
    const sx = r.width / W || 1
    const x = (e.clientX - r.left) / sx
    const y = (e.clientY - r.top) / sx
    const inside = x >= 0 && y >= 0 && x <= W && y <= H
    if (inside && !ptr.inside) {
      cur.x = x
      cur.y = y
    }
    ptr.x = x
    ptr.y = y
    ptr.inside = inside
  }
  const onOut = (e: MouseEvent) => {
    if (!e.relatedTarget) ptr.inside = false
  }

  function updateMask(t: number) {
    trail = trail.filter((p) => t - p.t < TRAIL)
    const lastP = trail.at(-1)
    if (
      presence > 0.02 &&
      (!lastP || Math.hypot(cur.x - lastP.x, cur.y - lastP.y) > 14)
    ) {
      trail.push({ x: cur.x, y: cur.y, t })
    }
    maskCtx.globalCompositeOperation = 'source-over'
    maskCtx.globalAlpha = 1
    maskCtx.clearRect(0, 0, mask.width, mask.height)
    const dabAt = (x: number, y: number, r: number, a: number) => {
      if (a <= 0.003) return
      maskCtx.globalAlpha = a
      maskCtx.drawImage(dab, (x - r) / S, (y - r) / S, (2 * r) / S, (2 * r) / S)
    }
    for (const p of trail) {
      const k = 1 - (t - p.t) / TRAIL
      dabAt(p.x, p.y, lensR * (0.65 + 0.35 * k), 0.6 * k * k)
    }
    dabAt(cur.x, cur.y, lensR, presence * 0.85)
    return presence > 0.003 || trail.length > 0
  }

  function drawSky(t: number, adapt: number) {
    g.globalCompositeOperation = 'source-over'
    g.clearRect(0, 0, W, H)
    g.globalAlpha = adapt * REST
    g.drawImage(haze, 0, 0, W, H)
    g.drawImage(starLayer, 0, 0, W, H)
    if (!still && updateMask(t)) {
      revealCtx.globalCompositeOperation = 'source-over'
      revealCtx.globalAlpha = 1
      revealCtx.clearRect(0, 0, reveal.width, reveal.height)
      revealCtx.globalAlpha = 1 - REST
      revealCtx.drawImage(haze, 0, 0)
      revealCtx.drawImage(starLayer, 0, 0)
      revealCtx.globalAlpha = 1
      revealCtx.drawImage(deep, 0, 0)
      revealCtx.globalCompositeOperation = 'destination-in'
      revealCtx.imageSmoothingEnabled = true
      revealCtx.drawImage(
        mask,
        0,
        0,
        mask.width * S * dpr,
        mask.height * S * dpr
      )
      g.globalAlpha = adapt
      g.drawImage(reveal, 0, 0, W, H)
    }
    g.globalCompositeOperation = 'destination-over'
    g.globalAlpha = 1
    const lg = g.createLinearGradient(0, hz - H * 0.4, 0, hz)
    lg.addColorStop(0, 'rgba(34,48,78,0)')
    lg.addColorStop(1, 'rgba(58,76,110,.42)')
    g.fillStyle = lg
    g.fillRect(0, hz - H * 0.4, W, H * 0.4)
    // a touch of deep blue at the zenith, not pure black
    const z = g.createLinearGradient(0, 0, 0, hz)
    z.addColorStop(0, '#060a17')
    z.addColorStop(1, '#04060d')
    g.fillStyle = z
    g.fillRect(0, 0, W, H)
    g.globalCompositeOperation = 'source-over'
  }

  function drawBright(t: number, wake: number) {
    for (const s of brightStars) {
      let a =
        s.a * wake * (still ? 0.9 : 0.72 + 0.28 * Math.sin(t * s.w + s.ph))
      if (presence > 0.005) {
        const dd = Math.hypot(s.x - cur.x, s.y - cur.y)
        if (dd < spotR) {
          a = Math.min(1, a * (1 + 0.5 * presence * (1 - dd / spotR)))
        }
      }
      if (s.r > 1.4) {
        const R = s.r * 5
        g.globalAlpha = a * 0.22
        g.drawImage(haloSprite, s.x - R, s.y - R, R * 2, R * 2)
      }
      g.fillStyle = `rgb(${TINTS[s.ti]})`
      if (s.spike) {
        const L = 5 + s.r * 5 * s.spike
        g.globalAlpha = a * 0.38 * s.spike
        g.fillRect(s.x - L, s.y - 0.35, L * 2, 0.7)
        g.fillRect(s.x - 0.35, s.y - L, 0.7, L * 2)
      }
      g.globalAlpha = a
      g.beginPath()
      g.arc(s.x, s.y, s.r, 0, 6.283)
      g.fill()
    }
  }

  // a meteor every 7–14 s, falling across the upper sky for about a second
  function drawMeteors(t: number) {
    if (still) return
    if (t > nextMeteor) {
      const x = W * (0.12 + Math.random() * 0.7)
      const y = hz * (0.04 + Math.random() * 0.32)
      const ang = (Math.random() < 0.5 ? 1 : -1) * (0.38 + Math.random() * 0.25)
      meteors.push({
        x,
        y,
        vx: Math.cos(ang) * 360 * Math.sign(ang || 1),
        vy: Math.abs(Math.sin(ang)) * 360,
        born: t,
        life: 0.8 + Math.random() * 0.3,
        len: 90 + Math.random() * 60,
      })
      nextMeteor = t + 7 + Math.random() * 7
    }
    meteors = meteors.filter((m) => t - m.born < m.life)
    for (const m of meteors) {
      const k = (t - m.born) / m.life
      const hx = m.x + m.vx * (t - m.born)
      const hy = m.y + m.vy * (t - m.born)
      const sp = Math.hypot(m.vx, m.vy)
      const tx = hx - (m.vx / sp) * m.len
      const ty = hy - (m.vy / sp) * m.len
      const a = Math.sin(Math.PI * k)
      const mg = g.createLinearGradient(tx, ty, hx, hy)
      mg.addColorStop(0, 'rgba(220,230,255,0)')
      mg.addColorStop(1, `rgba(236,242,255,${(0.85 * a).toFixed(3)})`)
      g.globalAlpha = 1
      g.strokeStyle = mg
      g.lineWidth = 1.2
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(tx, ty)
      g.lineTo(hx, hy)
      g.stroke()
      g.globalAlpha = 0.5 * a
      g.drawImage(haloSprite, hx - 5, hy - 5, 10, 10)
    }
  }

  function drawSea(t: number, adapt: number, wake: number) {
    g.globalAlpha = 1
    g.fillStyle = '#05080f'
    g.fillRect(0, hz, W, H - hz + 1)
    const sg = g.createLinearGradient(0, hz, 0, H)
    sg.addColorStop(0, 'rgba(62,80,116,.5)')
    sg.addColorStop(0.18, 'rgba(44,60,92,.3)')
    sg.addColorStop(0.55, 'rgba(26,36,58,.14)')
    sg.addColorStop(1, 'rgba(14,20,34,0)')
    g.fillStyle = sg
    g.fillRect(0, hz, W, H - hz + 1)
    const reach = Math.min(H - hz, hz * 0.8)
    for (let dd = 0; dd < reach; dd += 2) {
      const ripple = still
        ? 0
        : Math.sin(t * 0.9 + dd * 0.21) * (0.6 + dd * 0.035) +
          Math.sin(t * 1.7 + dd * 0.53) * 0.8
      g.globalAlpha = 0.65 * Math.exp(-dd / (H * 0.16)) * adapt
      g.drawImage(
        glow,
        0,
        (hz - dd) / S,
        gw,
        2 / S,
        ripple,
        hz + dd,
        gw * S,
        2.2
      )
    }
    g.fillStyle = 'rgb(156,174,212)'
    for (const s of strokes) {
      let a = s.a * (still ? 0.7 : 0.25 + 0.75 * Math.sin(t * s.w + s.ph) ** 2)
      if (presence > 0.005) {
        const dx = s.x - cur.x
        const dy = s.y - cur.y
        const d2 = dx * dx + dy * dy
        if (d2 < spotR * spotR) {
          a *= 1 + 2.5 * presence * (1 - Math.sqrt(d2) / spotR)
        }
      }
      g.globalAlpha = Math.min(a, 1)
      g.fillRect(s.x, s.y, s.l, 1)
    }
    for (const r of reflections) {
      for (let k = 0; k < 3; k++) {
        const sway = still ? 0 : Math.sin(t * 1.2 + r.ph + k) * 1.6
        const a =
          r.a *
          0.26 *
          (1 - k * 0.3) *
          wake *
          (still ? 0.8 : 0.5 + 0.5 * Math.sin(t * 1.9 + r.ph * 3 + k))
        if (a <= 0.004) continue
        g.globalAlpha = a
        g.fillStyle = `rgb(${r.c})`
        g.fillRect(r.x - 1.5 + sway, hz + r.dy * 0.5 + k * 2.4, 3 + k, 1)
      }
    }
    // the lantern's golden path, only while the boat sits on the sea
    const L = opts.lantern?.()
    if (L && L.y > hz - 60 && L.y < H) {
      const flick = still
        ? 1
        : 0.86 + 0.08 * Math.sin(t * 7.1) + 0.06 * Math.sin(t * 12.7 + 2)
      g.fillStyle = 'rgb(255,174,116)'
      const top = Math.max(hz, L.y + 6)
      for (const gl of lampGlints) {
        const y = top + gl.dy * ((H - top) / Math.max(1, H - hz))
        if (y > H) continue
        const sway = still ? 0 : Math.sin(t * 1.3 + gl.ph) * (0.5 + gl.q * 5)
        const glint = still ? 0.6 : 0.2 + 0.8 * Math.sin(t * gl.f + gl.ph) ** 2
        g.globalAlpha = 0.7 * (1 - gl.q) ** 1.3 * glint * flick
        g.fillRect(L.x - gl.w / 2 + sway, y, gl.w, 1)
      }
    }
  }

  function drawSpot() {
    if (presence < 0.005) return
    g.globalCompositeOperation = 'screen'
    g.globalAlpha = 1
    const rg = g.createRadialGradient(cur.x, cur.y, 0, cur.x, cur.y, spotR)
    rg.addColorStop(0, `rgba(186,204,246,${(0.1 * presence).toFixed(3)})`)
    rg.addColorStop(0.3, `rgba(160,180,230,${(0.04 * presence).toFixed(3)})`)
    rg.addColorStop(1, 'rgba(160,180,230,0)')
    g.fillStyle = rg
    g.fillRect(cur.x - spotR, cur.y - spotR, spotR * 2, spotR * 2)
    g.globalCompositeOperation = 'source-over'
  }

  let born = performance.now()
  function frame(now: number) {
    const t = now / 1000
    const age = now - born
    const adapt = still
      ? 1
      : 0.25 + 0.75 * (1 - (1 - clamp01((age - 100) / 3000)) ** 3)
    const wake = still ? 1 : clamp01(age / 900)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawSky(t, adapt)
    drawBright(t, wake)
    drawMeteors(t)
    drawSea(t, adapt, wake)
    if (!still) drawSpot()
  }

  let last = 0
  let raf = 0
  let disposed = false
  function loop(now: number) {
    raf = requestAnimationFrame(loop)
    if (now - last < FRAME_MS) return
    const dt = Math.min((now - last) / 1000, 0.08)
    last = now
    const k = 1 - 0.78 ** (dt * 60)
    cur.x += (ptr.x - cur.x) * k
    cur.y += (ptr.y - cur.y) * k
    presence +=
      ((ptr.inside ? 1 : 0) - presence) *
      (1 - (ptr.inside ? 0.9 : 0.95) ** (dt * 60))
    frame(now)
  }
  function start() {
    cancelAnimationFrame(raf)
    if (disposed) return
    build()
    trail = []
    if (still) frame(performance.now())
    else if (!document.hidden) raf = requestAnimationFrame(loop)
  }

  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  const ro = new ResizeObserver(() => {
    // The first call only reports the size just built for, and a hidden
    // pane reports 0: neither needs the sky built again.
    const r = (cv.parentElement ?? cv).getBoundingClientRect()
    const w = Math.round(r.width)
    const h = Math.round(r.height)
    if (!w || !h || (w === W && h === H)) return
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(start, 120)
  })
  ro.observe(cv.parentElement ?? cv)
  const onVisibility = () => {
    cancelAnimationFrame(raf)
    if (!document.hidden && !still && !disposed) {
      last = performance.now()
      raf = requestAnimationFrame(loop)
    }
  }
  window.addEventListener('pointermove', onPointer, { passive: true })
  document.addEventListener('mouseout', onOut)
  document.addEventListener('visibilitychange', onVisibility)
  born = performance.now()
  start()

  return {
    setStill(next) {
      if (next === still) return
      still = next
      start()
    },
    refresh() {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(start, 60)
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      ro.disconnect()
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('mouseout', onOut)
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
