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
 * Liquid glass, the same recipe as the sign-in dialog. Per element size we
 * bake three maps: the lens (how far the rim bends what is behind), a frost
 * mask (clear rim, frosted middle) and a shade (tint deepening towards the
 * middle, bezel glow, faint inner shadow). The SVG filter splits the bend
 * into R/G/B for a little dispersion at the rim only.
 *
 * SVG filters in backdrop-filter work in Chromium only; other browsers keep
 * the frosted CSS fallback. Filters are cached by size and options.
 */

export type GlassOptions = {
  bezel?: number
  depth?: number
  frost?: number
  /** Tint alpha at the rim and in the middle. */
  tint?: [number, number]
  /** Always dark (lightbox, pills over the night sea). */
  dark?: boolean
  tone?: 'sea'
}

type Resolved = {
  bezel: number
  depth: number
  frost: number
  tint: [number, number]
  tone?: 'sea'
}

type Baked = { map: string; mask: string; shade: string; span: number }

const NS = 'http://www.w3.org/2000/svg'
const MAX_CACHED = 30
const cache = new Map<string, string>()
let defs: SVGDefsElement | null = null
let counter = 0

export const glassSupported = (() => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false
  }
  const ua = navigator.userAgent
  return (
    'chrome' in window && /Chrome\//.test(ua) && !/CriOS|FxiOS|Firefox/.test(ua)
  )
})()

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function bake(
  w: number,
  h: number,
  r: number,
  o: Resolved,
  dark: boolean
): Baked {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')
  if (!x) throw new Error('No 2D canvas')
  const mp = x.createImageData(w, h)
  const mk = x.createImageData(w, h)
  const sh = x.createImageData(w, h)
  const M = mp.data
  const K = mk.data
  const H = sh.data
  const hx = w / 2
  const hy = h / 2
  const bez = o.bezel
  const clear = bez * 0.55
  const span = o.depth + 0.045 * Math.max(hx, hy)
  let T = [255, 255, 255]
  if (o.tone === 'sea') T = [12, 18, 40]
  else if (dark) T = [42, 42, 42]
  // on a white page the inner shadow reads as a grey box, so it is off in light mode
  const sk = dark || o.tone === 'sea' ? 0.14 : 0
  const gk = dark ? 0.16 : 0.1
  const [a0, a1] = o.tint
  for (let j = 0; j < h; j++) {
    const py = j + 0.5 - hy
    const qy = Math.abs(py) - (hy - r)
    for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4
      const px = i + 0.5 - hx
      const qx = Math.abs(px) - (hx - r)
      let dist: number
      let nx: number
      let ny: number
      if (qx > 0 && qy > 0) {
        const L = Math.hypot(qx, qy)
        dist = r - L
        nx = (qx / L) * Math.sign(px)
        ny = (qy / L) * Math.sign(py)
      } else if (qx > qy) {
        dist = r - qx
        nx = Math.sign(px)
        ny = 0
      } else {
        dist = r - qy
        nx = 0
        ny = Math.sign(py)
      }
      const s = clamp(dist / bez, 0, 1)
      const edge = 1 - s
      // the rim bends inwards (a thick rounded slab); the flat middle magnifies a touch
      const m = dist < bez ? Math.pow(1 - Math.max(dist, 0) / bez, 1.7) : 0
      const dx = -nx * o.depth * m - px * 0.045
      const dy = -ny * o.depth * m - py * 0.045
      M[k] = clamp(128 + (127.5 * dx) / span, 0, 255)
      M[k + 1] = clamp(128 + (127.5 * dy) / span, 0, 255)
      M[k + 2] = 128
      M[k + 3] = 255
      K[k + 3] = 255 * clamp((dist - clear * 0.35) / (clear * 0.65), 0, 1)
      if (dist < -0.5) continue
      const ta = a0 + (a1 - a0) * s
      const ga = Math.pow(edge, 2.6) * gk
      const sa = sk * Math.exp(-Math.pow((dist - 1.05 * bez) / (0.35 * bez), 2))
      const top = ga >= sa ? 255 : 0
      const a = Math.max(ga, sa)
      const oa = a + ta * (1 - a)
      for (let ch = 0; ch < 3; ch++) {
        H[k + ch] = (top * a + T[ch] * ta * (1 - a)) / oa
      }
      H[k + 3] = oa * 255 * clamp(dist + 0.5, 0, 1)
    }
  }
  const out: string[] = []
  for (const im of [mp, mk, sh]) {
    x.clearRect(0, 0, w, h)
    x.putImageData(im, 0, 0)
    out.push(c.toDataURL())
  }
  return { map: out[0], mask: out[1], shade: out[2], span }
}

function svg(tag: string, attrs: Record<string, string | number>) {
  const el = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}

function ensureDefs(): SVGDefsElement {
  if (defs?.isConnected) return defs
  const root = document.createElementNS(NS, 'svg')
  root.setAttribute('width', '0')
  root.setAttribute('height', '0')
  root.setAttribute('aria-hidden', 'true')
  root.style.position = 'absolute'
  defs = document.createElementNS(NS, 'defs')
  root.append(defs)
  document.body.append(root)
  return defs
}

function filterFor(
  w: number,
  h: number,
  r: number,
  o: Resolved,
  dark: boolean
): string {
  const key = [
    w,
    h,
    r,
    o.bezel,
    o.depth,
    o.frost,
    o.tint.join('/'),
    dark,
    o.tone ?? '',
  ].join('_')
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const id = `dw-glass-${++counter}`
  const baked = bake(w, h, r, o, dark)
  const box = { x: 0, y: 0, width: w, height: h }
  const f = svg('filter', {
    id,
    ...box,
    filterUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  })
  const displace = (scale: number, result: string) =>
    svg('feDisplacementMap', {
      in: 'SourceGraphic',
      in2: 'map',
      scale: (2 * baked.span * scale).toFixed(2),
      xChannelSelector: 'R',
      yChannelSelector: 'G',
      result,
    })
  const only = (src: string, values: string, result: string) =>
    svg('feColorMatrix', { in: src, type: 'matrix', values, result })
  f.append(
    svg('feImage', {
      ...box,
      href: baked.map,
      preserveAspectRatio: 'none',
      result: 'map',
    }),
    displace(1.11, 'dr'),
    displace(1, 'dg'),
    displace(0.89, 'db'),
    only('dr', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'r'),
    only('dg', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'g'),
    only('db', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'b'),
    svg('feComposite', {
      in: 'r',
      in2: 'g',
      operator: 'arithmetic',
      k2: 1,
      k3: 1,
      result: 'rg',
    }),
    svg('feComposite', {
      in: 'rg',
      in2: 'b',
      operator: 'arithmetic',
      k2: 1,
      k3: 1,
      result: 'bent',
    }),
    svg('feGaussianBlur', {
      in: 'bent',
      stdDeviation: o.frost,
      edgeMode: 'duplicate',
      result: 'soft',
    }),
    svg('feGaussianBlur', { in: 'bent', stdDeviation: 0.6, result: 'sharp' }),
    svg('feImage', {
      ...box,
      href: baked.mask,
      preserveAspectRatio: 'none',
      result: 'mask',
    }),
    svg('feComposite', {
      in: 'soft',
      in2: 'mask',
      operator: 'in',
      result: 'inner',
    }),
    svg('feComposite', {
      in: 'sharp',
      in2: 'mask',
      operator: 'out',
      result: 'rim',
    }),
    svg('feComposite', {
      in: 'inner',
      in2: 'rim',
      operator: 'over',
      result: 'glass',
    }),
    svg('feColorMatrix', {
      in: 'glass',
      type: 'saturate',
      values: dark ? 1.45 : 1.3,
      result: 'sat',
    })
  )
  const lift = svg('feComponentTransfer', { in: 'sat', result: 'lit' })
  for (const ch of ['R', 'G', 'B']) {
    lift.append(
      svg(`feFunc${ch}`, {
        type: 'linear',
        slope: dark ? 1.15 : 1.03,
        intercept: dark ? 0.02 : 0.005,
      })
    )
  }
  f.append(
    lift,
    svg('feImage', {
      ...box,
      href: baked.shade,
      preserveAspectRatio: 'none',
      result: 'shade',
    }),
    svg('feComposite', { in: 'shade', in2: 'lit', operator: 'over' })
  )
  ensureDefs().append(f)
  cache.set(key, id)
  if (cache.size > MAX_CACHED) {
    const [oldKey, oldId] = cache.entries().next().value as [string, string]
    cache.delete(oldKey)
    document.querySelector(`#${oldId}`)?.remove()
  }
  return id
}

function measure(el: HTMLElement, opts: GlassOptions) {
  const w = Math.round(el.offsetWidth)
  const h = Math.round(el.offsetHeight)
  if (!w || !h) return null
  const radius =
    Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
  const r = Math.round(Math.min(radius, w / 2, h / 2))
  const o: Resolved = {
    bezel: Math.round(Math.min(opts.bezel ?? 16, h / 2, w / 2)),
    depth: opts.depth ?? 10,
    frost: opts.frost ?? 5,
    tint: opts.tint ?? [0.4, 0.6],
    tone: opts.tone,
  }
  return { w, h, r, o }
}

/** Fits the lens to the element's current size. */
export function applyGlass(el: HTMLElement, opts: GlassOptions) {
  if (!glassSupported) return
  const lens = measure(el, opts)
  if (!lens) return
  const { w, h, r, o } = lens
  const dark =
    opts.dark === true || document.documentElement.classList.contains('dark')
  try {
    el.style.setProperty('--lens', `url(#${filterFor(w, h, r, o, dark)})`)
    el.classList.add('lensed')
  } catch {
    el.classList.remove('lensed')
  }
}

/**
 * Bakes the lens for the theme the page is not showing. Baking is slow, and a
 * theme change should find it ready instead of doing it mid-animation.
 */
export function warmGlass(el: HTMLElement, opts: GlassOptions) {
  if (!glassSupported || opts.dark === true) return
  const lens = measure(el, opts)
  if (!lens) return
  const { w, h, r, o } = lens
  try {
    filterFor(w, h, r, o, !document.documentElement.classList.contains('dark'))
  } catch {
    // applyGlass reports a failed bake when that theme is shown
  }
}

/** Removes every cached filter, e.g. when the page unmounts. */
export function disposeGlass() {
  for (const id of cache.values()) document.querySelector(`#${id}`)?.remove()
  cache.clear()
  defs?.parentElement?.remove()
  defs = null
}
