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
// Gargantua over the night Earth, behind the first screen: light bent by a
// still (Schwarzschild) hole, from tables made once (lens.ts, after Bruneton
// 2020), round a disk after what Double Negative published about
// Interstellar's; the real sky painted as the night sea paints its own
// (Hipparcos-2 stars as its dots, NASA's Milky Way as its faint band), NASA's
// Black Marble Earth; linear HDR through a bloom chain and a film grade, at
// the screen's own sharpness. The pointer lights the sky as on the night sea,
// bent round the hole. The camera holds still: the Earth and its air are
// drawn once and kept, and nothing is drawn while the first screen is out of
// sight.
import { BLACK_HOLE_ASSETS as ASSETS } from './assets'
import { governor } from './governor'
import {
  type Knobs,
  OWN_FRAME_QUERY,
  holeDistance,
  knobsFor,
  lookFrame,
  shadowAt,
  smooth,
} from './knobs'
import { type LensTables, N1, NC, NCAM, NR, buildLens, camTable } from './lens'
import {
  BAKE_DISK,
  COMPOSITE,
  DOWN,
  FINAL,
  HOLE,
  MASK,
  UP,
  VERTEX,
} from './shaders'
import {
  CELL_N,
  LIST_W,
  type StarLists,
  type StarLook,
  buildStars,
  gunzipped,
  unpackStars,
} from './stars'
import { CONTEXT, PHONE_QUERY } from './support'

export type BlackHoleOptions = {
  signal: AbortSignal
  /** After each frame, while its picture can still be read (the sign-in dialog's glass copies it) */
  onFrame?: () => void
  /** The GPU gave out (context lost, or too slow even at the lowest resolution): the page falls back */
  onFail?: (why: string) => void
}

export type BlackHole = { stop: () => void }

/** Thick gas (4500 K under a 6500 K white balance, pinker, as the film's), thin, all but gone */
const PAL = [1, 0.84, 0.88, 1, 0.47, 0.45, 0.55, 0.18, 0.13]
/** The grade's tint in the highlights: the film's are a little pink */
const GAIN = [1, 0.96, 0.97] as const
const AIR_PAL = [1, 0.82, 0.58, 0.06, 0.45, 1.1, 1.2, 0.85, 0.55]
/**
 * The box of city lights (and moonlit land): the ground the first screen
 * shows at any shape it is drawn at, lon 110.4E..163.6E, lat 56N..3.5S, cut
 * from NASA's Black Marble at 37.5 px a degree from lon 106E, lat 56N
 */
const CITY = {
  west: 106 + 164 / 37.5,
  east: 106 + 2160 / 37.5,
  north: 56,
  south: 56 - 2232 / 37.5,
}
const CITY_BOX = [
  (CITY.west + 180) / 360,
  (90 - CITY.north) / 180,
  360 / (CITY.east - CITY.west),
  180 / (CITY.north - CITY.south),
] as const
/** The aureole's weight per blur level (2, 4, 8 ... 256 px) */
const AURA_W = [0, 0, 0.1, 0.2, 0.3, 0.35, 0.3, 0.25]
const LEVELS = 8
const FOCAL = 1.4
const FLOW_PERIOD = 14
/** Stills of the disk start this far into its flow (s) */
const T0 = 3
/** At most this often (ms) a frame: a 120, 144 or 160 Hz screen gets every other one, as fluid for a sky this slow */
const MIN_GAP = 10.5
/** The pointer's trail: a point every TRAIL_STEP CSS px, at most TRAIL_MAX of them (shaders.ts reveal) */
const TRAIL_STEP = 36
const TRAIL_MAX = 32
/** The night sea drew its reveal as a dab every 14 CSS px: how thick that laid them */
const DAB_STEP = 14
/** The pointer's reveal is worked out at 1 / MS of the resolution */
const MS = 4
/** The Milky Way map's scale (bake): light per pixel of NASA's 16k map, log from 0.0018 to 0.06 */
const mwLog = (y: number) => Math.log2(y / 0.0018) / Math.log2(0.06 / 0.0018)
/** J2000 -> galactic (rows: the galactic centre, l = 90, the north galactic pole, in J2000) */
const GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
]

type V3 = [number, number, number]
const rad = (d: number) => (d * Math.PI) / 180
const seed = (k: number) => {
  const s = Math.sin(k * 12.9898) * 43758.5453
  return s - Math.floor(s)
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]
const add = (...vs: V3[]): V3 =>
  vs.reduce<V3>((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0])
const norm = (a: V3) => scale(a, 1 / Math.hypot(...a))
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
/** A basis (three column vectors), transposed: a world vector in its terms */
const applyT = (B: V3[], w: V3): V3 => [
  dot(B[0], w),
  dot(B[1], w),
  dot(B[2], w),
]

type Program = {
  p: WebGLProgram
  shaders: WebGLShader[]
  u: (name: string) => WebGLUniformLocation | null
}
type Target = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number }
type Chain = { downs: Target[]; ups: (Target | undefined)[] }

/**
 * Starts the black hole on the canvas (the first screen's sky). Resolves to
 * a handle once it is running (its first frame sets the canvas's
 * data-ready), or to null if the browser can't draw it, the pictures fail to
 * load (both call onFail) or `signal` aborted first. Aborting `signal` stops
 * it too.
 */
export async function startBlackHole(
  canvas: HTMLCanvasElement,
  opts: BlackHoleOptions
): Promise<BlackHole | null> {
  const phone = window.matchMedia(PHONE_QUERY).matches
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const K: Knobs = knobsFor(phone, reduced)
  // the frame as the poster under the canvas is cropped (black-hole.css)
  const frameOf = (w: number, h: number) =>
    lookFrame(w, h, K.hx, K.hy, window.matchMedia(OWN_FRAME_QUERY).matches)
  if (opts.signal.aborted) return null
  const context = canvas.getContext('webgl2', CONTEXT)
  if (!context || !context.getExtension('EXT_color_buffer_float')) {
    opts.onFail?.('webgl2')
    return null
  }
  const gl: WebGL2RenderingContext = context
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic')
  const parallel = gl.getExtension('KHR_parallel_shader_compile')
  const cleanups: (() => void)[] = []
  /** Deletes every GL object this made (deleting one twice is harmless) */
  const owned: (() => void)[] = [() => targets.forEach(dropTarget)]
  /** The render targets alive now (the resolution can change) */
  const targets = new Set<Target>()
  let stopped = false
  let raf = 0
  let worker: Worker | null = null
  let lensWorker: Worker | null = null
  const stop = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(raf)
    worker?.terminate()
    lensWorker?.terminate()
    for (const f of cleanups.splice(0)) f()
    delete canvas.dataset.ready
    // the GPU's memory back now, not when the canvas is collected
    for (const f of owned.splice(0)) f()
  }
  const onLost = (e: Event) => {
    e.preventDefault()
    stop()
    opts.onFail?.('lost')
  }
  canvas.addEventListener('webglcontextlost', onLost)
  cleanups.unshift(() => canvas.removeEventListener('webglcontextlost', onLost))
  // the page went (or fell back) while this was starting or running
  opts.signal.addEventListener(
    'abort',
    () => {
      stop()
      // a canvas gone from the page gives up its context too (one still on
      // it may be started again: React's strict mode does that)
      if (!canvas.isConnected) {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      }
    },
    { once: true }
  )

  // ------------------------------------------------------------ GL helpers
  // Programs compile on the driver's threads where it can: nothing asks whether
  // one is done until ready() has seen them all finish.
  function compile(fs: string): Program {
    const p = gl.createProgram()
    owned.push(() => gl.deleteProgram(p))
    const shaders = (
      [
        [gl.VERTEX_SHADER, VERTEX],
        [gl.FRAGMENT_SHADER, fs],
      ] as const
    ).map(([type, src]) => {
      const s = gl.createShader(type)
      if (!s) throw new Error('createShader failed')
      owned.push(() => gl.deleteShader(s))
      gl.shaderSource(s, src)
      gl.compileShader(s)
      gl.attachShader(p, s)
      return s
    })
    gl.linkProgram(p)
    const cache = new Map<string, WebGLUniformLocation | null>()
    return {
      p,
      shaders,
      u: (n) => {
        if (!cache.has(n)) cache.set(n, gl.getUniformLocation(p, n))
        return cache.get(n) ?? null
      },
    }
  }
  async function ready(progs: Program[]) {
    if (parallel) {
      while (
        !progs.every((P) =>
          gl.getProgramParameter(P.p, parallel.COMPLETION_STATUS_KHR)
        )
      ) {
        await new Promise((r) => setTimeout(r, 8))
        if (stopped) return
      }
    }
    for (const P of progs) {
      if (!gl.getProgramParameter(P.p, gl.LINK_STATUS)) {
        const log = P.shaders.map((s) => gl.getShaderInfoLog(s)).join('\n')
        throw new Error(
          log.trim() || gl.getProgramInfoLog(P.p) || 'link failed'
        )
      }
    }
  }
  /**
   * A render target. Light (HDR) by default, in 4 bytes a pixel (no alpha:
   * nothing reads it): a weak GPU's time goes mostly on moving pixels.
   */
  function target(
    w: number,
    h: number,
    internal: number = gl.R11F_G11F_B10F,
    type: number = gl.HALF_FLOAT,
    format: number = gl.RGB
  ): Target {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0
    )
    const t = { tex, fb, w, h }
    targets.add(t)
    return t
  }
  function dropTarget(t: Target | undefined) {
    if (!t) return
    gl.deleteTexture(t.tex)
    gl.deleteFramebuffer(t.fb)
    targets.delete(t)
  }
  function imageTexture(
    img: HTMLImageElement,
    wrapS: number,
    internal: number = gl.RGBA8,
    format: number = gl.RGBA
  ) {
    const tex = gl.createTexture()
    owned.push(() => gl.deleteTexture(tex))
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, format, gl.UNSIGNED_BYTE, img)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    if (aniso) {
      gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 16)
    }
    return tex
  }
  function dataTexture(
    w: number,
    h: number,
    internal: number,
    format: number,
    type: number,
    data: ArrayBufferView
  ) {
    const tex = gl.createTexture()
    owned.push(() => gl.deleteTexture(tex))
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }
  const load = async (src: string) => {
    const img = new Image()
    img.decoding = 'async'
    img.src = src
    await img.decode()
    return img
  }

  // ------------------------------------------------------------ the stars
  // Fetched here (so the page's preload of the pack is used), built in a
  // worker while the shaders compile and the pictures load.
  let cssW = canvas.clientWidth || window.innerWidth
  let cssH = canvas.clientHeight || window.innerHeight
  const look: StarLook = {
    smax: K.smax,
    perPx: (2 * Math.tan(rad(K.fov) / 2)) / frameOf(cssW, cssH).w,
    dpr: Math.min(window.devicePixelRatio || 1, K.dpr),
    gain: K.sa,
    size: K.sz,
  }
  async function starLists(): Promise<StarLists> {
    const res = await fetch(ASSETS.stars, { signal: opts.signal })
    if (!res.ok) throw new Error(`stars: ${res.status}`)
    const pack = await res.arrayBuffer()
    // the worker takes a copy; this one stays for building here if it can't
    const job = { pack: structuredClone(pack), look }
    try {
      return await new Promise<StarLists>((ok, fail) => {
        worker = new Worker(new URL('./stars.worker.ts', import.meta.url), {
          type: 'module',
        })
        worker.addEventListener(
          'message',
          (e: MessageEvent<StarLists & { error?: string }>) => {
            if (e.data.error) fail(new Error(e.data.error))
            else ok(e.data)
          }
        )
        worker.addEventListener('error', fail)
        worker.postMessage(job, [job.pack])
      })
    } catch {
      // no worker (a strict policy, an old browser): build here
      return buildStars(unpackStars(await gunzipped(pack)), look)
    } finally {
      worker?.terminate()
      worker = null
    }
  }
  // the lens tables too, in a worker of their own (a few hundred ms here if it can't)
  async function lensTables(): Promise<LensTables> {
    try {
      return await new Promise<LensTables>((ok, fail) => {
        lensWorker = new Worker(new URL('./lens.worker.ts', import.meta.url), {
          type: 'module',
        })
        lensWorker.addEventListener(
          'message',
          (e: MessageEvent<LensTables & { error?: string }>) => {
            if (e.data.error) fail(new Error(e.data.error))
            else ok(e.data)
          }
        )
        lensWorker.addEventListener('error', fail)
        lensWorker.postMessage(0)
      })
    } catch {
      return buildLens()
    } finally {
      lensWorker?.terminate()
      lensWorker = null
    }
  }

  // ------------------------------------------------------------ start
  // While the sky loads (nothing asked of the GPU) the screen shows its own
  // pace: the governor measures frames against it (governor.ts).
  const gov = governor(MIN_GAP)
  let probeAt = 0
  const probe = (now: number) => {
    if (stopped) return
    if (probeAt) gov.screen(now - probeAt)
    probeAt = now
    raf = requestAnimationFrame(probe)
  }
  raf = requestAnimationFrame(probe)
  const hole = compile(HOLE)
  const mask = compile(MASK)
  const comp = compile(COMPOSITE)
  const down = compile(DOWN)
  const up = compile(UP)
  const fin = compile(FINAL)
  const bake = compile(BAKE_DISK)
  let loaded: [
    HTMLImageElement,
    HTMLImageElement,
    HTMLImageElement,
    HTMLImageElement,
    StarLists,
    LensTables,
    void,
  ]
  // a network that never finishes gets the still picture, not a blank sky for good
  let timer = 0
  const late = new Promise<never>((_, no) => {
    timer = window.setTimeout(() => no(new Error('timeout')), 20000)
  })
  try {
    loaded = await Promise.race([
      Promise.all([
        load(ASSETS.lights),
        load(ASSETS.moon),
        load(ASSETS.land),
        load(ASSETS.milky),
        starLists(),
        lensTables(),
        ready([bake, hole, mask, comp, down, up, fin]),
      ]),
      late,
    ])
    window.clearTimeout(timer)
    cancelAnimationFrame(raf)
  } catch (err) {
    window.clearTimeout(timer)
    if (stopped || opts.signal.aborted) return null
    stop()
    opts.onFail?.(String(err))
    return null
  }
  if (stopped || opts.signal.aborted) {
    stop()
    return null
  }
  const [cityImg, moonImg, landImg, milkyImg, starData, lensData] = loaded

  // the disk's polar texture, baked once
  const diskTex = (() => {
    const w = 2048
    const h = 2048
    const t = target(w, h, gl.RGBA8, gl.UNSIGNED_BYTE, gl.RGBA)
    gl.viewport(0, 0, w, h)
    gl.useProgram(bake.p)
    gl.uniform2f(bake.u('uRes'), w, h)
    gl.uniform4f(bake.u('uBake'), K.bsw, K.blen, K.btear, K.bcon)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindTexture(gl.TEXTURE_2D, t.tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    )
    gl.generateMipmap(gl.TEXTURE_2D)
    return t.tex
  })()
  const cityTex = imageTexture(cityImg, gl.CLAMP_TO_EDGE, gl.R8, gl.RED)
  const moonTex = imageTexture(moonImg, gl.CLAMP_TO_EDGE)
  const landTex = imageTexture(landImg, gl.REPEAT, gl.R8, gl.RED)
  const milkyTex = imageTexture(milkyImg, gl.REPEAT)
  const cellTex = dataTexture(
    6 * CELL_N,
    CELL_N,
    gl.R32UI,
    gl.RED_INTEGER,
    gl.UNSIGNED_INT,
    starData.index
  )
  const listTex = dataTexture(
    LIST_W,
    starData.rows,
    gl.RGBA32F,
    gl.RGBA,
    gl.FLOAT,
    starData.list
  )
  /** Bound where the Earth's kept picture is not made yet (nothing reads it then) */
  const blank = dataTexture(
    1,
    1,
    gl.RGBA8,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array(4)
  )

  // the lens tables; the camera's own for its distance (view)
  const sweepTex = dataTexture(N1, 2, gl.R32F, gl.RED, gl.FLOAT, lensData.sweep)
  const pathTex = dataTexture(
    NC,
    2 * NR,
    gl.R32F,
    gl.RED,
    gl.FLOAT,
    lensData.path
  )
  const camRows = new Float32Array(NCAM)
  const camTex = dataTexture(NCAM, 1, gl.R32F, gl.RED, gl.FLOAT, camRows)

  // ------------------------------------------------------------ the view
  // Every device pixel, up to 2 a CSS pixel: the hole's light comes from
  // tables, so the screen's own sharpness is affordable; a machine that can't
  // keep up gets fewer while it can't (governor.ts).
  let dpr = 1
  let W = 1
  let H = 1
  let F = 1
  /** The frame the look is set in (knobs.ts lookFrame): its size, and the canvas's offset in it (device px) */
  let frame = { w: 1, h: 1, x: 0, y: 0 }
  /** Its centre, in the canvas's px from the bottom left */
  let CX = 0
  let CY = 0
  /** The hole's picture, the Earth in it: the scene */
  let holeT: Target | undefined
  /** Where you have looked (MASK) */
  let maskT: Target | undefined
  let maskLive = false
  let bloomC: Chain | undefined
  /** The Earth and its air, worked out once (cacheEarth): what of the sky still shows through, and their light */
  let earthMulT: Target | undefined
  let earthAddT: Target | undefined
  /** How far up the screen (device px) the Earth and its air reach */
  let earthH = 0
  /** A blur chain; its way back up reaches level `last` (blur), the finer levels have none */
  function chain(last = 0): Chain {
    const downs: Target[] = []
    const ups: (Target | undefined)[] = []
    for (let i = 0; i < LEVELS; i++) {
      const w = Math.max(1, Math.round(W / 2 ** (i + 1)))
      const h = Math.max(1, Math.round(H / 2 ** (i + 1)))
      downs.push(target(w, h))
      ups.push(i >= last ? target(w, h) : undefined)
    }
    return { downs, ups }
  }
  const dropChain = (c: Chain | undefined) => {
    if (c) [...c.downs, ...c.ups].forEach(dropTarget)
  }
  function allocate() {
    // read again each time: the page zoomed, or the window moved to another screen
    dpr = Math.min(window.devicePixelRatio || 1, K.dpr)
    W = Math.max(1, Math.round(cssW * dpr * gov.res))
    H = Math.max(1, Math.round(cssH * dpr * gov.res))
    frame = frameOf(W, H)
    CX = frame.w / 2 - frame.x
    CY = frame.h / 2 - frame.y
    F = frame.w / 2 / Math.tan(rad(K.fov) / 2)
    canvas.width = W
    canvas.height = H
    dropTarget(holeT)
    dropTarget(maskT)
    dropChain(bloomC)
    holeT = target(W, H)
    maskT = target(
      Math.ceil(W / MS),
      Math.ceil(H / MS),
      gl.R8,
      gl.UNSIGNED_BYTE,
      gl.RED
    )
    maskLive = false
    bloomC = chain()
    bloomFresh = true
  }

  // the direction of the frame's point (share of width / height from the top left), camera space
  const screenDir = (x: number, y: number): V3 =>
    norm([((x - 0.5) * frame.w) / F, ((0.5 - y) * frame.h) / F, 1])
  let PITCH = 0
  /** Earth-fixed axes of the camera's right, up and forward (x to 0N 0E, y to 0N 90E, z north) */
  function earthBasis(): { U: V3; B: V3[] } {
    const la = rad(K.lat)
    const lo = rad(K.lon)
    const hd = rad(K.hdg)
    const U: V3 = [
      Math.cos(la) * Math.cos(lo),
      Math.cos(la) * Math.sin(lo),
      Math.sin(la),
    ]
    const E: V3 = [-Math.sin(lo), Math.cos(lo), 0]
    const N: V3 = [
      -Math.sin(la) * Math.cos(lo),
      -Math.sin(la) * Math.sin(lo),
      Math.cos(la),
    ]
    const fh = add(scale(N, Math.cos(hd)), scale(E, Math.sin(hd)))
    const rh = add(scale(N, -Math.sin(hd)), scale(E, Math.cos(hd)))
    const fw = add(scale(fh, Math.cos(PITCH)), scale(U, Math.sin(PITCH)))
    const upc = add(scale(fh, -Math.sin(PITCH)), scale(U, Math.cos(PITCH)))
    const r = rad(K.roll)
    return {
      U,
      B: [
        add(scale(rh, Math.cos(r)), scale(upc, Math.sin(r))),
        add(scale(rh, -Math.sin(r)), scale(upc, Math.cos(r))),
        fw,
      ],
    }
  }
  /**
   * Earth-fixed -> J2000: the sky turned so galactic (gl, gb) is behind the
   * hole, the band (towards higher l) along ga there
   */
  let toSky = (v: V3): V3 => v
  /** What the still camera sees, worked out for the canvas's size (frameTheSky) */
  const view = {
    B: [] as V3[],
    /** the Earth's centre, towards the hole (camera space, the Earth's radius 1) */
    C: [0, 0, 0] as V3,
    L: [0, 0, 1] as V3,
    /** the hole camera: its distance (Schwarzschild radii), place and basis */
    D: 1,
    cam: [0, 0, 1] as V3,
    camM: [] as number[],
    /** the hole's centre (device px from the bottom left) and its frame */
    hx: 0,
    hy: 0,
    holeM: [] as number[],
    skyM: [] as number[],
  }
  function frameTheSky() {
    // the camera's tilt, from where the limb sits on the screen
    PITCH =
      -Math.acos(1 / (1 + K.alt / 6371)) -
      Math.atan(((0.5 - K.limb) * frame.h) / F)
    const { U, B } = earthBasis()
    const X = screenDir(K.hx, K.hy)
    const l = rad(K.gl)
    const b = rad(K.gb)
    const a = rad(K.ga)
    const P: V3 = [
      Math.cos(b) * Math.cos(l),
      Math.cos(b) * Math.sin(l),
      Math.sin(b),
    ]
    const El: V3 = [-Math.sin(l), Math.cos(l), 0]
    const Eb: V3 = [
      -Math.sin(b) * Math.cos(l),
      -Math.sin(b) * Math.sin(l),
      Math.cos(b),
    ]
    const step = screenDir(
      K.hx + 0.01 * Math.cos(a),
      K.hy - ((0.01 * frame.w) / frame.h) * Math.sin(a)
    )
    // the band's direction on the screen, as a tangent at X; (X, T, U) has the
    // handedness of (P, El, Eb) in the camera's own terms, so the sky is not
    // mirrored (the camera's right, up, forward are left-handed)
    const T = norm(cross(cross(X, sub(step, X)), X))
    const Up = cross(T, X)
    toSky = (v) => {
      const c = applyT(B, v)
      const g = add(
        scale(P, dot(X, c)),
        scale(El, dot(T, c)),
        scale(Eb, dot(Up, c))
      )
      return [0, 1, 2].map(
        (i) => GAL[0][i] * g[0] + GAL[1][i] * g[1] + GAL[2][i] * g[2]
      ) as V3
    }
    // the hole sits at (hx, hy): the camera looks at it from the Earth
    const L = X
    view.B = B
    view.L = L
    view.C = applyT(B, scale(U, -(1 + K.alt / 6371)))
    const D = holeDistance(Math.atan((K.hr * frame.w) / F))
    const el = rad(K.hel)
    view.D = D
    view.cam = [0, D * Math.sin(el), D * Math.cos(el)]
    view.camM = lookAt(view.cam)
    view.hx = CX + (F * L[0]) / L[2]
    view.hy = CY + (F * L[1]) / L[2]
    const rgt = norm([L[2], 0, -L[0]])
    view.holeM = [...rgt, ...cross(L, rgt), ...L]
    view.skyM = [...toSky(B[0]), ...toSky(B[1]), ...toSky(B[2])]
    // the camera's lens table for its distance
    camTable(D, camRows)
    gl.bindTexture(gl.TEXTURE_2D, camTex)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, NCAM, 1, gl.RED, gl.FLOAT, camRows)
    // where the hole is (CSS px) and its Einstein radius (CSS px): the sky round it follows the pointer
    seen.x = (view.hx / W) * cssW
    seen.y = (1 - view.hy / H) * cssH
    seen.rE = (F * Math.tan(Math.sqrt(2 / D)) * cssW) / W
  }

  // ------------------------------------------------------------ the pointer
  // As on the night sea: where you look the sky shows more (a trail of where
  // you have looked, that lingers) under a soft light. Both are lights on the
  // sky, so the hole bends them as it bends the stars: near it they wrap
  // round the ring, the sky behind flows. The shader works the trail out
  // itself from its points (no mask drawn and sent each frame).
  const ptr = { x: 0, y: 0, inside: false }
  const cur = { x: 0, y: 0 }
  let presence = 0
  const trail: { x: number; y: number; t: number }[] = []
  const point = (e: PointerEvent) => {
    if (!ptr.inside) {
      cur.x = e.clientX
      cur.y = e.clientY
    }
    ptr.x = e.clientX
    ptr.y = e.clientY
    ptr.inside = true
  }
  const leave = () => {
    ptr.inside = false
  }
  const lift = (e: PointerEvent) => {
    if (e.pointerType === 'touch') leave()
  }
  const out = (e: MouseEvent) => {
    if (!e.relatedTarget) leave()
  }
  window.addEventListener('pointermove', point, { passive: true })
  window.addEventListener('pointerdown', point, { passive: true })
  window.addEventListener('pointerup', lift, { passive: true })
  window.addEventListener('pointercancel', leave, { passive: true })
  window.addEventListener('blur', leave)
  document.addEventListener('mouseout', out)
  cleanups.push(() => {
    window.removeEventListener('pointermove', point)
    window.removeEventListener('pointerdown', point)
    window.removeEventListener('pointerup', lift)
    window.removeEventListener('pointercancel', leave)
    window.removeEventListener('blur', leave)
    document.removeEventListener('mouseout', out)
  })
  /** The trail's points for the shader: x, y (device px from the bottom left), radius (device px), strength */
  const TRAIL = new Float32Array(4 * TRAIL_MAX)
  let trailN = 0
  const trailBox = [0, 0, 0, 0]
  /** The canvas's top on the screen (CSS px): the pointer is in the screen's terms, the canvas scrolls */
  let top = 0
  function updateTrail(t: number) {
    let kept = 0
    for (const q of trail) if (t - q.t < K.trail) trail[kept++] = q
    trail.length = kept
    const ty = cur.y - top
    const lastP = trail.at(-1)
    if (
      presence > 0.02 &&
      (!lastP || Math.hypot(cur.x - lastP.x, ty - lastP.y) > TRAIL_STEP)
    ) {
      trail.push({ x: cur.x, y: ty, t })
      if (trail.length > TRAIL_MAX) trail.shift()
    }
    const sx = W / cssW
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    trailN = 0
    for (const q of trail) {
      const k = 1 - (t - q.t) / K.trail
      const r = K.lens * (0.65 + 0.35 * k) * sx
      const x = q.x * sx
      const y = H - q.y * sx
      const i = trailN++ * 4
      TRAIL[i] = x
      TRAIL[i + 1] = y
      TRAIL[i + 2] = r
      TRAIL[i + 3] = 0.7 * k * k
      x0 = Math.min(x0, x - r)
      y0 = Math.min(y0, y - r)
      x1 = Math.max(x1, x + r)
      y1 = Math.max(y1, y + r)
    }
    trailBox[0] = x0
    trailBox[1] = y0
    trailBox[2] = x1
    trailBox[3] = y1
  }
  /** The sky behind the hole, moved (Einstein radii, the hole's right and up) */
  const flow = { x: 0, y: 0 }
  /** Where the hole is (CSS px, in the canvas) and its Einstein radius (CSS px) */
  const seen = { x: 0, y: 0, rE: 1 }

  // ------------------------------------------------------------ drawing
  function quad(
    prog: Program,
    fbo: WebGLFramebuffer | null,
    w: number,
    h: number
  ) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.viewport(0, 0, w, h)
    gl.useProgram(prog.p)
    gl.uniform2f(prog.u('uRes'), w, h)
  }
  function bind(
    prog: Program,
    name: string,
    unit: number,
    tex: WebGLTexture | null
  ) {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(prog.u(name), unit)
  }
  /**
   * Blurs `src` down the chain and back up to level `last` (its result in
   * c.ups[last]), weighting level i by weight(i)
   */
  function blur(
    src0: Target,
    c: Chain,
    weight: (i: number) => [number, number, number],
    thr: number,
    last = 0
  ) {
    blurDown(src0, c, thr)
    blurUp(c, weight, last)
  }
  function blurDown(src0: Target, c: Chain, thr: number) {
    let src = src0
    for (let i = 0; i < LEVELS; i++) {
      const d = c.downs[i]
      quad(down, d.fb, d.w, d.h)
      bind(down, 'uSrc', 0, src.tex)
      gl.uniform2f(down.u('uTexel'), 1 / src.w, 1 / src.h)
      gl.uniform1f(down.u('uThr'), i === 0 ? thr : 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      src = d
    }
  }
  function blurUp(
    c: Chain,
    weight: (i: number) => [number, number, number],
    last = 0
  ) {
    for (let i = LEVELS - 1; i >= last; i--) {
      const w = weight(i)
      const u = c.ups[i]
      const low = i === LEVELS - 1 ? c.downs[i] : c.ups[i + 1]
      if (!u || !low) break
      quad(up, u.fb, u.w, u.h)
      bind(up, 'uLow', 0, low.tex)
      bind(up, 'uCur', 1, c.downs[i].tex)
      gl.uniform2f(up.u('uTexel'), 1 / low.w, 1 / low.h)
      gl.uniform3f(up.u('uW'), ...w)
      gl.uniform1f(up.u('uLowW'), i === LEVELS - 1 ? 0 : 1)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
  }
  function lookAt(pos: V3) {
    const fw = norm(scale(pos, -1))
    const rt = norm([-fw[2], 0, fw[0]])
    const upv = cross(rt, fw)
    return [...rt, ...upv, ...fw]
  }

  /**
   * How far up the screen (device px from the bottom) the Earth and the air
   * over it reach: the cone round the direction to its centre C (camera
   * space, radius 1) out to 13 scale heights above the ground, where the air
   * adds under a thousandth of the night's light
   */
  function earthTop(C: V3) {
    const dc = Math.hypot(...C)
    const ra = 1 + 13 * K.hs
    if (dc <= ra) return H
    const a = Math.asin(ra / dc)
    const c = scale(C, 1 / dc)
    const e1 = norm(cross(c, Math.abs(c[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]))
    const e2 = cross(c, e1)
    let reach = 0
    for (let i = 0; i < 128; i++) {
      const th = (i / 128) * 2 * Math.PI
      const d = add(
        scale(c, Math.cos(a)),
        scale(e1, Math.sin(a) * Math.cos(th)),
        scale(e2, Math.sin(a) * Math.sin(th))
      )
      // round beside or behind the camera: below the screen if it goes down, unbounded if up
      if (d[2] < 0.02) {
        if (d[1] >= 0) return H
        continue
      }
      reach = Math.max(reach, CY + (F * d[1]) / d[2])
    }
    return Math.min(H, Math.ceil(reach) + 4)
  }

  /** Pass 1: the hole and the sky (and the Earth kept from cacheEarth, once there is one) */
  function drawHole(t: number, lit: boolean) {
    if (!holeT) return
    const P = FLOW_PERIOD
    const p0 = ((t % P) + P) % P
    const p1 = (((t + P / 2) % P) + P) % P
    const w0 = 1 - Math.abs(p0 - P / 2) / (P / 2)
    const sx = W / cssW
    const px = cur.x * sx
    const py = H - (cur.y - top) * sx
    const here = lit ? presence : 0
    const rE = Math.sqrt(2 / view.D)
    quad(hole, holeT.fb, W, H)
    bind(hole, 'uDiskTex', 0, diskTex)
    bind(hole, 'uMilky', 1, milkyTex)
    bind(hole, 'uCells', 2, cellTex)
    bind(hole, 'uStarList', 3, listTex)
    bind(hole, 'uEarthMul', 4, earthMulT?.tex ?? blank)
    bind(hole, 'uSweep', 5, sweepTex)
    bind(hole, 'uPath', 6, pathTex)
    bind(hole, 'uCamPhi', 7, camTex)
    bind(hole, 'uEarthAdd', 8, earthAddT?.tex ?? blank)
    bind(hole, 'uMask', 9, lit ? (maskT?.tex ?? blank) : blank)
    gl.uniform3f(hole.u('uCam'), ...view.cam)
    gl.uniformMatrix3fv(hole.u('uCamM'), false, view.camM)
    gl.uniform4f(hole.u('uLens'), view.hx, view.hy, F / FOCAL, FOCAL)
    gl.uniform2f(
      hole.u('uRoll'),
      Math.cos(rad(K.hroll)),
      Math.sin(rad(K.hroll))
    )
    gl.uniform4f(hole.u('uFlow'), p0, p1, w0, K.gf)
    gl.uniform2f(
      hole.u('uFlowO'),
      seed(Math.floor(t / P)),
      seed(Math.floor((t + P / 2) / P) + 50)
    )
    gl.uniform4f(hole.u('uLook'), K.dl, shadowAt(view.D, FOCAL), 0, 0)
    gl.uniform4f(hole.u('uLook2'), K.gd, K.gi, K.gw, K.ge)
    gl.uniform3fv(hole.u('uPal'), PAL)
    gl.uniform3f(hole.u('uGeo'), K.rin, K.rout, K.rw)
    gl.uniform2f(hole.u('uDust'), K.dg, K.dh)
    gl.uniform3f(hole.u('uView'), CX, CY, F)
    gl.uniform4f(hole.u('uFrame'), frame.x, frame.y, frame.w, frame.h)
    gl.uniformMatrix3fv(hole.u('uHoleM'), false, view.holeM)
    gl.uniformMatrix3fv(hole.u('uSkyM'), false, view.skyM)
    gl.uniform4f(hole.u('uSky'), 0, 0, K.sg, K.sd)
    gl.uniform4f(hole.u('uSky2'), W / cssW, 0, K.tw, t)
    gl.uniform4f(hole.u('uMW'), K.mw, mwLog(K.mwbp), mwLog(K.mwmax), K.mwg)
    gl.uniform4f(hole.u('uMW2'), K.mwsat, K.mwst, K.dfr, 0)
    gl.uniform3f(hole.u('uNight'), K.nr / 255, K.ng / 255, K.nb / 255)
    // the night sea's glow low in the sky
    gl.uniform4f(hole.u('uGlow'), K.nhr / 255, K.nhg / 255, K.nhb / 255, K.nha)
    gl.uniform2f(hole.u('uGlowY'), K.gy0, K.gy1)
    gl.uniform2f(hole.u('uBand'), K.mwsoft, K.mwsp)
    gl.uniform3f(hole.u('uBandC'), K.mwfr / 255, K.mwfg / 255, K.mwfb / 255)
    // the eye used to the dark at once: so the poster under the canvas shows the sky
    gl.uniform4f(hole.u('uLook3'), K.rest, 1, 1, K.night)
    gl.uniform4f(hole.u('uPtr'), px, py, here, K.spot * sx)
    gl.uniform4f(hole.u('uEarth'), ...view.C, 1)
    gl.uniform1f(hole.u('uEarthTop'), earthMulT ? earthH : 0)
    gl.uniform4f(
      hole.u('uShift'),
      flow.x * rE,
      flow.y * rE,
      K.fr0 * rE,
      K.fr1 * rE
    )
    gl.uniform1f(hole.u('uCellN'), CELL_N)
    gl.uniform1f(hole.u('uSkyMag'), K.smag)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /**
   * The Earth and its air, worked out once for the still camera (they never
   * move): what of the sky behind still shows (rgb) with how much of the
   * ground covers it (a), and their light. The air glows with the hole's
   * blurred light (the aureole), from a picture of the hole made for it.
   * The pass 1 adds them to every frame.
   */
  function cacheEarth() {
    dropTarget(earthMulT)
    dropTarget(earthAddT)
    earthMulT = earthAddT = undefined
    earthH = earthTop(view.C)
    if (!holeT || earthH <= 0) return
    drawHole(T0, false)
    const aura = chain(2)
    blur(holeT, aura, (i) => [AURA_W[i], AURA_W[i], AURA_W[i]], 0, 2)
    const mul = target(W, earthH, gl.RGBA8, gl.UNSIGNED_BYTE, gl.RGBA)
    const lightT = target(W, earthH)
    const parts: [number, Target][] = [
      [0, mul],
      [1, lightT],
    ]
    for (const [part, t] of parts) {
      quad(comp, t.fb, W, earthH)
      // in the whole screen's terms: the aureole is read by where on it a pixel is
      gl.uniform2f(comp.u('uRes'), W, H)
      bind(comp, 'uCity', 1, cityTex)
      bind(comp, 'uMoon', 2, moonTex)
      bind(comp, 'uHoleBlur', 3, aura.ups[2]?.tex ?? null)
      bind(comp, 'uLand', 4, landTex)
      gl.uniform2f(comp.u('uC'), CX, CY)
      gl.uniform1f(comp.u('uF'), F)
      gl.uniform3f(comp.u('uEarthC'), ...view.C)
      gl.uniformMatrix3fv(comp.u('uEM'), false, [
        ...view.B[0],
        ...view.B[1],
        ...view.B[2],
      ])
      gl.uniform3f(comp.u('uL'), ...view.L)
      gl.uniform4f(comp.u('uCityBox'), ...CITY_BOX)
      gl.uniform4f(comp.u('uAir'), K.hs, K.er, K.ea, K.ez)
      gl.uniform4f(comp.u('uSun'), K.sun, K.city, K.glint, T0)
      gl.uniform3fv(comp.u('uAirPal'), AIR_PAL)
      gl.uniform4f(comp.u('uTune'), K.em, K.el, K.eo, K.mie)
      gl.uniform1f(comp.u('uRimFloor'), K.rf)
      gl.uniform1i(comp.u('uPart'), part)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    dropChain(aura)
    earthMulT = mul
    earthAddT = lightT
  }

  /** Where you have looked, drawn while there is any (cleared once when it has all gone) */
  function drawMask() {
    if (!maskT) return
    const on = presence > 0.003 || trailN > 0
    if (!on && !maskLive) return
    maskLive = on
    if (!on) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, maskT.fb)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return
    }
    const sx = W / cssW
    quad(mask, maskT.fb, maskT.w, maskT.h)
    gl.uniform1f(mask.u('uScale'), W / maskT.w)
    gl.uniform4f(
      mask.u('uCur'),
      cur.x * sx,
      H - (cur.y - top) * sx,
      K.lens * sx,
      presence
    )
    gl.uniform4fv(mask.u('uTrail'), TRAIL)
    gl.uniform1i(mask.u('uTrailN'), trailN)
    gl.uniform4fv(mask.u('uTrailBox'), trailBox)
    gl.uniform1f(mask.u('uTrailK'), 1.2 / (DAB_STEP * sx))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const bloomWeight = (i: number): [number, number, number] => {
    const k = i / (LEVELS - 1)
    const w = (0.6 + 0.8 * k) * (k > 0.5 ? K.bw : 1)
    return [w, w * (1 - 0.22 * k * K.hal), w * (1 - 0.36 * k * K.hal)]
  }
  let bloomHalf = false
  /** The bloom chain is new (allocate): all of it this frame, so the glare doesn't blink */
  let bloomFresh = true
  /** The bloom levels' weights summed (the final pass divides by it) */
  let bloomSum = 0
  for (let i = 0; i < LEVELS; i++) bloomSum += bloomWeight(i)[0]
  function draw(t: number) {
    if (!holeT || !bloomC) return
    drawMask()
    drawHole(t, true)
    // bloom (the lenses' veiling flare): only what is brighter than `thr`; the wide levels warmer.
    // Half of it a frame, down one frame and back up the next: the glare of a disk this slow
    // is none the worse a frame late, and no frame carries all of it
    if (bloomFresh) {
      bloomFresh = false
      blurDown(holeT, bloomC, K.thr)
      blurUp(bloomC, bloomWeight)
    } else {
      bloomHalf = !bloomHalf
      if (bloomHalf) blurDown(holeT, bloomC, K.thr)
      else blurUp(bloomC, bloomWeight)
    }
    quad(fin, null, W, H)
    bind(fin, 'uScene', 0, holeT.tex)
    bind(fin, 'uBloom', 1, bloomC.ups[0]?.tex ?? null)
    gl.uniform4f(fin.u('uTone'), K.ex, K.bl / bloomSum, K.sat, K.gr)
    gl.uniform3f(fin.u('uLift'), 0.004 * K.lift, 0.01 * K.lift, 0.022 * K.lift)
    gl.uniform3f(fin.u('uGain'), ...GAIN)
    gl.uniform4f(fin.u('uTone2'), K.con, K.vig, t, K.wp)
    gl.uniform4f(fin.u('uFrame'), frame.x, frame.y, frame.w, frame.h)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function resize() {
    cssW = canvas.clientWidth || window.innerWidth
    cssH = canvas.clientHeight || window.innerHeight
    allocate()
    frameTheSky()
    cacheEarth()
  }
  resize()
  // A new size is taken up by the next frame, just before it draws: a canvas
  // resized after its frame was drawn shows that frame black.
  let boxChanged = false
  const ro = new ResizeObserver(() => {
    boxChanged = true
  })
  ro.observe(canvas)
  cleanups.push(() => ro.disconnect())
  /** The canvas's box changed, or its pixels did (the window moved to another screen) */
  function outgrown(): boolean {
    const ratio = Math.min(window.devicePixelRatio || 1, K.dpr)
    if (!boxChanged && ratio === dpr) return false
    boxChanged = false
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    return (!!w && w !== cssW) || (!!h && h !== cssH) || ratio !== dpr
  }

  // ------------------------------------------------------------ the loop
  // Frames only while the first screen shows: on the screen, the tab in view,
  // and (where its words fade as the page leaves them) not yet faded out.
  let onScreen = true
  let running = false
  /** The first screen fades out over this much scrolling (night-sea.css ns-leave); past it nothing shows */
  const fadesOut =
    !reduced && CSS.supports?.('animation-timeline: scroll()') === true
  const wanted = () =>
    onScreen &&
    !document.hidden &&
    (!fadesOut || window.scrollY < 0.72 * window.innerHeight)
  function sync() {
    if (stopped) return
    const want = wanted()
    if (want && !running) {
      running = true
      drawnAt = 0
      tickAt = 0
      // what went before the pause says nothing about the frames to come
      gov.resume(performance.now())
      raf = requestAnimationFrame(loop)
    } else if (!want && running) {
      running = false
      cancelAnimationFrame(raf)
    }
  }
  const io = new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting)
    sync()
  })
  io.observe(canvas)
  window.addEventListener('scroll', sync, { passive: true })
  document.addEventListener('visibilitychange', sync)
  cleanups.push(() => {
    io.disconnect()
    window.removeEventListener('scroll', sync)
    document.removeEventListener('visibilitychange', sync)
  })

  function govern(ms: number, now: number) {
    const say = gov.frame(ms, now)
    if (say === 'fail') {
      stop()
      opts.onFail?.('slow')
    } else if (say) {
      allocate()
      frameTheSky()
      cacheEarth()
    }
  }

  /** When the last frame was drawn, and the loop last ran (0: not since it started) */
  let drawnAt = 0
  let tickAt = 0
  /** Seconds drawn so far (the sky's clock stands still while nothing shows) */
  let clock = 0
  let first = true
  function loop(now: number) {
    if (stopped || !running) return
    raf = requestAnimationFrame(loop)
    const tick = tickAt ? now - tickAt : 0
    tickAt = now
    if (drawnAt && now - drawnAt < MIN_GAP) {
      // nothing drawn on this one: the screen's own pace
      if (tick) gov.screen(tick)
      return
    }
    const gap = drawnAt ? now - drawnAt : 0
    drawnAt = now
    if (outgrown()) {
      resize()
      gov.resume(now)
    } else if (gap) govern(gap, now)
    if (stopped) return
    const dt = Math.min(gap / 1000, 0.05)
    clock += dt
    top = canvas.getBoundingClientRect().top
    const k = 1 - Math.pow(0.78, dt * 60)
    cur.x += (ptr.x - cur.x) * k
    cur.y += (ptr.y - cur.y) * k
    presence +=
      ((ptr.inside ? 1 : 0) - presence) *
      (1 - Math.pow(ptr.inside ? 0.9 : 0.95, dt * 60))
    // near the hole the sky behind it follows the pointer, a little late
    const rx = (cur.x - seen.x) / seen.rE
    const ry = (seen.y - (cur.y - top)) / seen.rE
    const d = Math.hypot(rx, ry)
    const q =
      presence * (1 - smooth(K.fp0, K.fp1, d)) * (d > 1.6 ? 1.6 / d : 1) * K.fl
    const kf = 1 - Math.pow(0.94, dt * 60)
    flow.x += (q * rx - flow.x) * kf
    flow.y += (q * ry - flow.y) * kf
    const t = reduced ? 0 : clock
    updateTrail(clock)
    draw(T0 + t)
    if (first) {
      first = false
      canvas.dataset.ready = '1'
    }
    opts.onFrame?.()
  }
  sync()
  return { stop }
}
