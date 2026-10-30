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
// The gateway: the models on the left, the tools people use on the right, and
// between them the black hole every request passes through (a still picture,
// gateway.tsx). Light leaves a model, falls into the disk's left end, crosses
// in front of the hole with the gas and comes out of the right end for each
// tool that takes that model. Drawn on a 2D canvas over the stage, in the
// stage's CSS px.

export const MODELS = [
  'Claude',
  'OpenAI',
  'Gemini',
  'DeepSeek',
  'Qwen',
  'Kimi',
  'GLM',
  'MiniMax',
] as const
export type Model = (typeof MODELS)[number]

/** The makers that serve Claude's format as well as OpenAI's chat format */
const CLAUDE_FORMAT_MAKERS: readonly Model[] = [
  'Claude',
  'DeepSeek',
  'Qwen',
  'Kimi',
  'GLM',
  'MiniMax',
]
/** The models each tool takes: Codex and Gemini CLI speak their own vendor's format, Claude Code Claude's, Pi and OpenCode Claude's and OpenAI's (as their guides set them up), the general clients any */
export const ROUTES: Record<string, readonly Model[]> = {
  'Claude Code': CLAUDE_FORMAT_MAKERS,
  Codex: ['OpenAI'],
  'Gemini CLI': ['Gemini'],
  Pi: ['OpenAI', ...CLAUDE_FORMAT_MAKERS],
  'Cherry Studio': MODELS,
  Cline: MODELS,
  Cursor: MODELS,
  OpenCode: ['OpenAI', ...CLAUDE_FORMAT_MAKERS],
}
/** Each model's light, soft enough for the night (sRGB): silver, clay, blue, then the makers' own hues washed out */
export const TINT: Record<Model, readonly [number, number, number]> = {
  Claude: [236, 170, 140],
  OpenAI: [233, 236, 243],
  Gemini: [157, 190, 240],
  DeepSeek: [132, 150, 250],
  Qwen: [184, 168, 250],
  Kimi: [146, 214, 236],
  GLM: [150, 222, 188],
  MiniMax: [244, 154, 172],
}
/** How often each maker's requests fly, against the others: the big three most */
const WEIGHT: Record<Model, number> = {
  Claude: 3,
  OpenAI: 3,
  Gemini: 2,
  DeepSeek: 1,
  Qwen: 1,
  Kimi: 1,
  GLM: 1,
  MiniMax: 1,
}
/** The disk's own light (4500 K under the film's grade: a pink white) */
const DISK = [240, 224, 228] as const
/** The format each coding tool sends; the general clients send OpenAI's chat format */
const TOOL_FORMAT: Record<string, string> = {
  'Claude Code': 'Messages',
  Codex: 'Responses',
  'Gemini CLI': 'generateContent',
  Pi: 'Messages',
  OpenCode: 'Messages',
}
/** What a request is called on its way in ("200 OK" on the way out): the format its tool sends it in */
export function requestFormat(model: Model, tool: string): string {
  // Pi and OpenCode send GPT models to the Responses API
  if (model === 'OpenAI' && (tool === 'Pi' || tool === 'OpenCode')) {
    return 'Responses'
  }
  return TOOL_FORMAT[tool] ?? 'Chat Completions'
}
/** The disk's ends, in shadow radii from the centre */
const MEET = 3.25
const N = 40
/** Seconds a request spends crossing the disk */
const CROSS = 1

const isModel = (id: string): id is Model =>
  (MODELS as readonly string[]).includes(id)

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const ease = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
const rgba = (c: readonly number[], a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`

/** A soft round light, drawn once and stamped (much cheaper than a gradient a frame) */
function glowSprite(c: readonly number[]): HTMLCanvasElement {
  const s = document.createElement('canvas')
  s.width = s.height = 64
  const g = s.getContext('2d')
  if (!g) return s
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, rgba(c, 1))
  grad.addColorStop(0.22, rgba(c, 0.55))
  grad.addColorStop(1, rgba(c, 0))
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return s
}

type Pt = { x: number; y: number }
type Path = { x: Float32Array; y: Float32Array; l: Float32Array; len: number }
const newPath = (): Path => ({
  x: new Float32Array(N + 1),
  y: new Float32Array(N + 1),
  l: new Float32Array(N + 1),
  len: 0,
})

/** A cubic from a (leaving along ta) to b (arriving along tb), sampled into the path with cumulative lengths */
function curve(
  path: Path,
  a: Pt,
  ta: readonly number[],
  b: Pt,
  tb: readonly number[]
) {
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  const c1x = a.x + ta[0] * d * 0.42
  const c1y = a.y + ta[1] * d * 0.42
  const c2x = b.x - tb[0] * d * 0.38
  const c2y = b.y - tb[1] * d * 0.38
  let len = 0
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const u = 1 - t
    const x =
      u * u * u * a.x +
      3 * u * u * t * c1x +
      3 * u * t * t * c2x +
      t * t * t * b.x
    const y =
      u * u * u * a.y +
      3 * u * u * t * c1y +
      3 * u * t * t * c2y +
      t * t * t * b.y
    if (i) len += Math.hypot(x - path.x[i - 1], y - path.y[i - 1])
    path.x[i] = x
    path.y[i] = y
    path.l[i] = len
  }
  path.len = len
}

/** The point a share u of the way along a path */
function along(path: Path, u: number, out: Pt): Pt {
  const s = clamp01(u) * path.len
  let i = 1
  while (i < N && path.l[i] < s) i++
  const k = clamp01((s - path.l[i - 1]) / (path.l[i] - path.l[i - 1] || 1))
  out.x = path.x[i - 1] + (path.x[i] - path.x[i - 1]) * k
  out.y = path.y[i - 1] + (path.y[i] - path.y[i - 1]) * k
  return out
}

/** The routes lit by looking at a chip: the chip and those at the other ends of its strands */
export function linkedTo(id: string | null): Set<string> | null {
  if (!id) return null
  const set = new Set([id])
  for (const [tool, models] of Object.entries(ROUTES)) {
    for (const m of models) {
      if (m === id) set.add(tool)
      if (tool === id) set.add(m)
    }
  }
  return set
}

/**
 * A request to send: a model (by WEIGHT), then a tool that takes it. While a
 * chip is looked at (`active`), only along that chip's routes.
 */
export function pickRequest(
  active: string | null,
  rand: () => number = Math.random
): [Model, string] | null {
  const toolsFor = (m: Model): string[] =>
    Object.keys(ROUTES).filter(
      (t) => ROUTES[t].includes(m) && (!active || active === m || active === t)
    )
  const models = MODELS.filter((m) => toolsFor(m).length)
  const last = models.at(-1)
  if (!last) return null
  let total = 0
  for (const m of models) total += WEIGHT[m]
  let x = rand() * total
  let model = last
  for (const m of models) {
    x -= WEIGHT[m]
    if (x < 0) {
      model = m
      break
    }
  }
  const tools = toolsFor(model)
  return [
    model,
    tools[Math.min(tools.length - 1, Math.floor(rand() * tools.length))],
  ]
}

/** The hole in the stage: centre and shadow radius (CSS px), its image's turn (rad, counter-clockwise) */
export type HoleOnScreen = { x: number; y: number; r: number; roll: number }

type Packet = {
  m: Model
  t: string
  ph: 0 | 1 | 2
  u: number
  cross: number
  v: number
  size: number
  label: boolean
}

export type GatewayStrands = {
  /** Where the chips are, in the stage (after layout changes) */
  layout: () => void
  /** One frame. vis = how much of the gateway shows (0..1), from where the page is */
  frame: (hole: HoleOnScreen, now: number, vis: number) => void
  stop: () => void
}

export function startGatewayStrands(opts: {
  stage: HTMLElement
  canvas: HTMLCanvasElement
  /** The element that dims the other chips while one is looked at */
  picker: HTMLElement
  chips: HTMLElement[]
  /** Models above the hole, tools below it (narrow screens), instead of left and right */
  stacked: boolean
  still: boolean
}): GatewayStrands {
  const { stage, canvas, picker, chips, stacked, still } = opts
  const ctx = canvas.getContext('2d')
  // from now on the stage's words and chips come and go with the strands (black-hole.css);
  // without a 2D canvas there are no strands, and they simply show
  if (ctx) stage.classList.add('ns-gw-live')
  const sprites: Record<string, HTMLCanvasElement> = {
    white: glowSprite([246, 244, 248]),
    disk: glowSprite(DISK),
  }
  for (const m of MODELS) sprites[m] = glowSprite(TINT[m])

  // chips: where their strands start or end (stage px), and which way they leave or arrive
  type Anchor = Pt & { into: boolean; t: readonly number[] }
  const anchors = new Map<string, Anchor>()
  const strands = new Map<string, Path>()
  let W = 0
  let H = 0
  let dpr = 1
  /** An element's box in the stage, by its offsets: its entrance transform (still sliding in) does not count */
  function boxIn(el: HTMLElement) {
    let x = 0
    let y = 0
    let at: Element | null = el
    while (at instanceof HTMLElement && at !== stage) {
      x += at.offsetLeft
      y += at.offsetTop
      at = at.offsetParent
    }
    return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight }
  }
  function layout() {
    W = stage.offsetWidth
    H = stage.offsetHeight
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    for (const el of chips) {
      const id = el.dataset.id
      if (!id) continue
      const r = boxIn(el)
      const into = isModel(id)
      // side by side: from a model's right edge, into a tool's left; stacked: from a model's foot, into a tool's head
      let x = into ? r.left + r.width + 3 : r.left - 3
      let y = r.top + r.height / 2
      if (stacked) {
        x = r.left + r.width / 2
        y = into ? r.top + r.height + 3 : r.top - 3
      }
      anchors.set(id, { into, x, y, t: stacked ? [0, 1] : [1, 0] })
      if (!strands.has(id)) strands.set(id, newPath())
    }
  }

  // looking at a chip (hover, keyboard focus) lights its routes and the chips at their other ends
  let active: string | null = null
  let lit: Set<string> | null = null
  /** Still (less motion): the last frame drawn, drawn again when the lit routes change */
  let drawn: { hole: HoleOnScreen; vis: number } | null = null
  function pick(id: string | null) {
    active = id
    lit = linkedTo(id)
    const set = lit
    picker.classList.toggle('ns-gw-picking', !!set)
    for (const el of chips) {
      el.classList.toggle('ns-gw-lit', !!set && set.has(el.dataset.id ?? ''))
    }
    if (drawn) frame(drawn.hole, performance.now(), drawn.vis)
  }
  const off: (() => void)[] = []
  for (const el of chips) {
    const id = el.dataset.id ?? null
    const enter = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') pick(id)
    }
    const leave = () => pick(null)
    const focus = () => pick(id)
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)
    el.addEventListener('focus', focus)
    el.addEventListener('blur', leave)
    off.push(() => {
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerleave', leave)
      el.removeEventListener('focus', focus)
      el.removeEventListener('blur', leave)
    })
  }

  // requests in flight: along a model's strand (0), across the disk (1), out along a tool's (2)
  const packets: Packet[] = []
  let spawnAt = 0
  const flare = { in: 0, out: 0 }
  function spawn() {
    const next = pickRequest(active)
    if (!next) return
    const [m, t] = next
    packets.push({
      m,
      t,
      ph: 0,
      u: 0,
      cross: 0,
      v: 0.85 + Math.random() * 0.3,
      size: 0.8 + Math.random() * 0.6,
      label: Math.random() < 0.16,
    })
  }

  let shownAt = -1
  let goneAt = -1e9
  let lastNow = 0
  let clear = false
  const P: Pt = { x: 0, y: 0 }
  const Q: Pt = { x: 0, y: 0 }
  const tipL: Pt = { x: 0, y: 0 }
  const tipR: Pt = { x: 0, y: 0 }

  /** One strand, drawn from its start to `upto` of the way: a faint line with light running along it */
  function drawStrand(
    g: CanvasRenderingContext2D,
    path: Path,
    upto: number,
    tint: readonly number[],
    alpha: number,
    now: number,
    into: boolean
  ) {
    if (upto <= 0.001 || alpha <= 0.003) return
    const n = Math.max(1, Math.ceil(upto * N))
    const end = along(path, upto, Q)
    const trace = () => {
      g.beginPath()
      g.moveTo(path.x[0], path.y[0])
      for (let i = 1; i < n; i++) g.lineTo(path.x[i], path.y[i])
      g.lineTo(end.x, end.y)
    }
    // fainter at the chip, brighter where it meets the disk
    const grad = g.createLinearGradient(
      path.x[0],
      path.y[0],
      path.x[N],
      path.y[N]
    )
    grad.addColorStop(into ? 0 : 1, rgba(tint, 0.2 * alpha))
    grad.addColorStop(into ? 1 : 0, rgba(tint, 0.42 * alpha))
    g.setLineDash([])
    g.lineWidth = 6
    g.strokeStyle = rgba(tint, 0.045 * alpha)
    trace()
    g.stroke()
    g.lineWidth = 1
    g.strokeStyle = grad
    trace()
    g.stroke()
    if (still) return
    g.setLineDash([2, 13])
    g.lineDashOffset = -(now / 1000) * 46
    g.lineWidth = 1.2
    g.strokeStyle = rgba([248, 246, 250], 0.4 * alpha)
    trace()
    g.stroke()
    g.setLineDash([])
  }

  function stamp(
    g: CanvasRenderingContext2D,
    sprite: HTMLCanvasElement,
    x: number,
    y: number,
    r: number,
    a: number
  ) {
    if (a <= 0.003) return
    g.globalAlpha = Math.min(1, a)
    g.drawImage(sprite, x - r, y - r, 2 * r, 2 * r)
    g.globalAlpha = 1
  }

  const labelW = new Map<string, number>()
  function label(
    g: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    a: number
  ) {
    if (a <= 0.01) return
    g.font = '500 10px ui-monospace, "SF Mono", Menlo, monospace'
    let w = labelW.get(text)
    if (w === undefined) {
      w = g.measureText(text).width
      labelW.set(text, w)
    }
    w += 14
    const h = 18
    g.globalAlpha = a
    g.fillStyle = 'rgba(9,12,21,.78)'
    g.strokeStyle = 'rgba(238,240,245,.18)'
    g.lineWidth = 1
    g.beginPath()
    g.roundRect(x - w / 2, y - h / 2, w, h, h / 2)
    g.fill()
    g.stroke()
    g.fillStyle = 'rgba(238,240,245,.82)'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, x, y + 0.5)
    g.globalAlpha = 1
  }

  function frame(hole: HoleOnScreen, now: number, visIn: number) {
    if (still) drawn = { hole, vis: visIn }
    let vis = visIn
    const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0
    lastNow = now
    if (!ctx) return
    // the stage's words, chips and strands come in as it settles round the hole and go as it leaves
    if (shownAt < 0 && vis > 0.55) {
      shownAt = now
      stage.classList.add('ns-gw-on')
    } else if (shownAt >= 0 && vis < 0.35) {
      shownAt = -1
      goneAt = now
      stage.classList.remove('ns-gw-on')
    }
    let revIn = 1
    let revOut = 1
    if (!still) {
      const age = shownAt < 0 ? 0 : (now - shownAt) / 1000
      revIn = ease((age - 0.25) / 1)
      revOut = ease((age - 0.75) / 1)
      // leaving: everything fades out together, quickly
      if (shownAt < 0) {
        const out = 1 - ease((now - goneAt) / 350)
        if (out <= 0) packets.length = 0
        revIn = revOut = out > 0 ? 1 : 0
        vis *= out
      }
    }
    if (vis <= 0.001) {
      if (!clear) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        clear = true
      }
      return
    }
    clear = false

    // the hole in the stage's px; its disk's ends along the turned image
    const cx = hole.x
    const cy = hole.y
    const tx = Math.cos(hole.roll)
    const ty = -Math.sin(hole.roll)
    const tt = [tx, ty]
    tipL.x = cx - tx * MEET * hole.r
    tipL.y = cy - ty * MEET * hole.r
    tipR.x = cx + tx * MEET * hole.r
    tipR.y = cy + ty * MEET * hole.r
    for (const [id, a] of anchors) {
      const path = strands.get(id)
      if (!path) continue
      if (a.into) curve(path, a, a.t, tipL, tt)
      else curve(path, tipR, tt, a, a.t)
    }

    const g = ctx
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    g.globalCompositeOperation = 'lighter'
    const set = lit
    for (const [id, a] of anchors) {
      const path = strands.get(id)
      if (!path) continue
      const on = !set || set.has(id) ? 1 : 0.22
      drawStrand(
        g,
        path,
        a.into ? revIn : revOut,
        a.into && isModel(id) ? TINT[id] : DISK,
        vis * on,
        now,
        a.into
      )
    }

    // where the strands touch the disk, a soft light that swells as requests go in and come out
    const breathe = still ? 1 : 0.8 + 0.2 * Math.sin((now / 1000) * 1.3)
    flare.in *= Math.exp(-dt * 3)
    flare.out *= Math.exp(-dt * 3)
    stamp(
      g,
      sprites.disk,
      tipL.x,
      tipL.y,
      hole.r * 1.1,
      vis * revIn * (0.16 * breathe + 0.22 * flare.in)
    )
    stamp(
      g,
      sprites.disk,
      tipR.x,
      tipR.y,
      hole.r * 1.1,
      vis * revOut * (0.16 * breathe + 0.22 * flare.out)
    )

    // a few requests a second, more along the routes being looked at
    if (!still && revOut > 0.5 && now > spawnAt && packets.length < 34) {
      spawn()
      spawnAt = now + (active ? 120 : 160) * (0.6 + Math.random() * 0.8)
    }
    const labels: [string, number, number, number][] = []
    for (let i = packets.length - 1; i >= 0; i--) {
      const k = packets[i]
      const pin = strands.get(k.m)
      const pout = strands.get(k.t)
      if (!pin || !pout) {
        packets.splice(i, 1)
        continue
      }
      if (k.ph === 0) {
        // falling in: faster as it nears the hole
        k.u += ((95 + 280 * k.u * k.u) * k.v * dt) / Math.max(pin.len, 1)
        if (k.u >= 1) {
          k.ph = 1
          k.cross = CROSS
          flare.in = Math.min(1.6, flare.in + 0.35)
        }
      } else if (k.ph === 1) {
        k.cross -= dt
        if (k.cross <= 0) {
          k.ph = 2
          k.u = 0
          flare.out = Math.min(1.6, flare.out + 0.35)
        }
      } else {
        // flung out, slowing as it reaches the tool
        k.u +=
          ((320 - 230 * Math.pow(k.u, 0.6)) * k.v * dt) / Math.max(pout.len, 1)
        if (k.u >= 1) {
          packets.splice(i, 1)
          continue
        }
      }
      // looking at a chip: its own requests bright, those passing its other end dim, the rest faint
      let on = 1
      if (set) {
        const ends = Number(set.has(k.m)) + Number(set.has(k.t))
        on = [0.15, 0.25, 1][ends]
      }
      if (k.ph === 1) {
        // carried round the near side of the disk, in front of the hole: a little below its middle
        const s = 1 - k.cross / CROSS
        const show = ease(s / 0.08) * (1 - ease((s - 0.92) / 0.08))
        const lift = Math.sin(Math.PI * s) * hole.r * 0.18
        stamp(
          g,
          sprites.white,
          tipL.x + (tipR.x - tipL.x) * s - ty * lift,
          tipL.y + (tipR.y - tipL.y) * s + tx * lift,
          hole.r * (0.3 + 0.12 * k.size),
          vis * on * show * (0.55 + 0.45 * k.size)
        )
        continue
      }
      const into = k.ph === 0
      const path = into ? pin : pout
      // whiter near the disk; gone into its light at the end, out of it at the start
      const heat = into ? ease((k.u - 0.55) / 0.45) : 1 - ease(k.u / 0.4)
      const fade =
        (into ? 1 - ease((k.u - 0.88) / 0.12) : ease(k.u / 0.08)) *
        (into ? ease(k.u / 0.06) : 1 - ease((k.u - 0.92) / 0.08))
      const a = vis * on * fade * (0.55 + 0.45 * k.size)
      if (a < 0.01) continue
      const head = along(path, k.u, P)
      // a short trail behind the head
      const du = 0.018 + 0.03 * (into ? k.u * k.u : 1 - k.u)
      const tint = TINT[k.m]
      const col = [0, 1, 2].map((j) =>
        Math.round(tint[j] + (255 - tint[j]) * heat * 0.7)
      )
      g.lineCap = 'round'
      let prevX = head.x
      let prevY = head.y
      for (let j = 1; j <= 6; j++) {
        if (k.u - du * j < 0) break
        const q = along(path, k.u - du * j, Q)
        g.strokeStyle = rgba(col, a * 0.7 * (1 - j / 7))
        g.lineWidth = 1.8 * k.size
        g.beginPath()
        g.moveTo(prevX, prevY)
        g.lineTo(q.x, q.y)
        g.stroke()
        prevX = q.x
        prevY = q.y
      }
      stamp(
        g,
        heat > 0.5 ? sprites.white : sprites[k.m],
        head.x,
        head.y,
        7 + 5 * heat + 3 * k.size,
        a
      )
      if (k.label && on > 0.5) {
        // mid-strand only: clear of the chips and of the disk's light
        const show = into
          ? ease((k.u - 0.1) / 0.1) * (1 - ease((k.u - 0.45) / 0.15))
          : ease((k.u - 0.3) / 0.15) * (1 - ease((k.u - 0.78) / 0.12))
        labels.push([
          into ? requestFormat(k.m, k.t) : '200 OK',
          head.x,
          head.y - 14,
          vis * show * 0.95,
        ])
      }
    }
    g.globalCompositeOperation = 'source-over'
    // never two at once in the same place (a looked-at route runs many requests): the brightest wins
    labels.sort((p, q) => q[3] - p[3])
    const shown: [string, number, number, number][] = []
    for (const l of labels) {
      if (shown.every((o) => Math.hypot(o[1] - l[1], o[2] - l[2]) > 90)) {
        shown.push(l)
      }
    }
    for (const l of shown) label(g, ...l)
  }

  return {
    layout,
    frame,
    stop() {
      for (const f of off) f()
      pick(null)
      stage.classList.remove('ns-gw-on', 'ns-gw-live')
      ctx?.setTransform(1, 0, 0, 1, 0, 0)
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}

/** The hole's picture in the middle (tex/gateway-hole.webp, 1472 x 760): its centre (shares of the picture), its shadow's radius (share of its width), its height (share of its width) */
export const HUB = { x: 0.5, y: 400 / 760, r: 160 / 1472, aspect: 760 / 1472 }
/** How far the hole's light reaches above and below its centre (shadow radii): the arc, the ring under it */
const REACH = 2.15 + 1.75

/**
 * The hole's shadow radius (CSS px) in the gap between the chips (core: its
 * box), leaving the strands room to reach its ends (MEET radii out); its arc
 * and the ring under it fit the gap's height (stacked: models above, tools
 * below; side by side on very wide screens). w: the page's width.
 */
export function hubRadius(
  stacked: boolean,
  core: { width: number; height: number },
  w: number
): number {
  const high = ((core.height - 8) / REACH) * 3.3
  const room = stacked
    ? Math.min(core.width / 2 - 24, high)
    : Math.min(core.width / 2 - Math.min(190, Math.max(120, 0.13 * w)), high)
  // phones' chips are small and the hole sits alone in its row: it may be larger there
  const most = w <= 640 ? 0.11 : 0.042
  return Math.max(0.01 * w, Math.min(most * w, room / 3.3))
}

/**
 * How much of the stage shows (0..1): of its height, or of the screen's when
 * it is taller than the screen (stacked on a phone turned sideways), so it can
 * always come in.
 */
export function shownShare(
  e: Pick<
    IntersectionObserverEntry,
    'isIntersecting' | 'intersectionRect' | 'boundingClientRect' | 'rootBounds'
  >,
  screenHeight: number
): number {
  const full = Math.min(
    e.boundingClientRect.height,
    e.rootBounds?.height ?? screenHeight
  )
  if (!e.isIntersecting || full <= 0) return 0
  return Math.min(1, e.intersectionRect.height / full)
}

/**
 * Runs the gateway: sizes the hole's picture to the gap between the chips
 * and draws the strands while the stage is on the screen (nothing at all
 * while it is not). Returns a function that stops it.
 */
export function runGateway(opts: {
  stage: HTMLElement
  canvas: HTMLCanvasElement
  core: HTMLElement
  hub: HTMLElement
  picker: HTMLElement
  stacked: boolean
  still: boolean
}): () => void {
  const chips = [...opts.stage.querySelectorAll<HTMLElement>('.ns-gw-chip')]
  const strands = startGatewayStrands({
    stage: opts.stage,
    canvas: opts.canvas,
    picker: opts.picker,
    chips,
    stacked: opts.stacked,
    still: opts.still,
  })
  const hole: HoleOnScreen = { x: 0, y: 0, r: 1, roll: 0 }
  function place() {
    strands.layout()
    const core = opts.core
    const r = hubRadius(
      opts.stacked,
      { width: core.offsetWidth, height: core.offsetHeight },
      window.innerWidth
    )
    // the core's middle in the stage (offsets: the chips' entrance transforms don't count)
    let x = core.offsetWidth / 2
    let y = core.offsetHeight / 2
    let at: Element | null = core
    while (at instanceof HTMLElement && at !== opts.stage) {
      x += at.offsetLeft
      y += at.offsetTop
      at = at.offsetParent
    }
    hole.x = x
    hole.y = y
    hole.r = r
    const w = r / HUB.r
    const style = opts.hub.style
    style.width = `${w}px`
    style.left = `${core.offsetWidth / 2 - HUB.x * w}px`
    style.top = `${core.offsetHeight / 2 - HUB.y * w * HUB.aspect}px`
  }
  let vis = 0
  let raf = 0
  let running = false
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    strands.frame(hole, now, vis)
  }
  function seen(share: number) {
    vis = share
    const on = vis > 0
    if (opts.still) {
      if (on) strands.frame(hole, performance.now(), vis)
      return
    }
    if (on && !running) {
      running = true
      raf = requestAnimationFrame(loop)
    } else if (!on && running) {
      running = false
      cancelAnimationFrame(raf)
    }
  }
  // (a browser too old to say whether the stage is on the screen draws it all the time)
  const io =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) seen(shownShare(e, window.innerHeight))
          },
          { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
        )
      : null
  const ro = new ResizeObserver(() => {
    place()
    if (opts.still && vis > 0) strands.frame(hole, performance.now(), vis)
  })
  place()
  if (io) io.observe(opts.stage)
  else seen(1)
  ro.observe(opts.stage)
  return () => {
    cancelAnimationFrame(raf)
    io?.disconnect()
    ro.disconnect()
    strands.stop()
  }
}
