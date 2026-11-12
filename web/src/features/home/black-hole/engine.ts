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
// The black hole over a small night Earth, on the first screen (its own chunk).
//
// The work is split so nothing blocks the page: the shaders compile in the
// background, the disk's texture and each ray's path are worked out once, a strip
// a frame, under the poster. After that a frame only reads them and moves the gas.
// Nothing is drawn while the first screen is out of sight or the tab hidden, at
// most 60 frames a second unless the pointer is on the hole, and persistently
// late frames lower the resolution (scene.ts paceFrame).
//
// The pointer is a small mass over the hole and its disk only: light behind it
// bends, and the gas it touches stirs (WAKE, a small polar picture that only runs
// while there is stirred gas). Anywhere else it does nothing.
import { BLACK_HOLE_ASSETS as ASSETS } from './assets'
import {
  EARTH,
  EARTH_LOOK,
  FRAME_ASPECT,
  HOLE,
  POINTER_LENS,
  QUALITY_MIN,
  QUALITY_STEP,
  canvasSize,
  earthBox,
  frameDue,
  gravityAt,
  newPace,
  paceFrame,
} from './scene'
import {
  BAKE_DISK,
  DOWN,
  EARTH as EARTH_FS,
  FINAL,
  FLOW,
  GEOM,
  RING,
  UP,
  VERTEX,
  WAKE,
} from './shaders'
import { CONTEXT } from './support'

export type BlackHoleOptions = {
  /** Aborting stops the engine and frees what it holds */
  signal: AbortSignal
  /** After each frame */
  onFrame?: () => void
  /** The GPU gave out, or the sky can't be drawn: the poster stays */
  onFail?: () => void
}
export type BlackHole = { stop: () => void }

type Program = {
  p: WebGLProgram
  shaders: WebGLShader[]
  u: (name: string) => WebGLUniformLocation | null
}
type Target = {
  tex: WebGLTexture
  fb: WebGLFramebuffer
  w: number
  h: number
}
/** What each pixel's ray does, and the Earth: worked out once per canvas size */
type Baked = {
  w: number
  h: number
  g: WebGLTexture[]
  fb: WebGLFramebuffer
  earth: Target
  box: [number, number, number, number]
}

const LEVELS = 5
const NOISE_W = 4096
const NOISE_H = 1024
const BAKE_ROWS = 24
const NOISE_ROWS = 32
const WAKE_W = 384
const WAKE_H = 96
/** Seconds stirred gas takes to fade, and how long the pass runs after the last stir */
const WAKE_FADE = 5
const WAKE_RUN = 18
const INWARD_DRIFT = 0.22
const FLOW_SPEED = 0.8

export function startBlackHole(
  canvas: HTMLCanvasElement,
  opts: BlackHoleOptions
): BlackHole {
  // the page was left while this chunk came
  if (opts.signal.aborted) return { stop: () => undefined }
  const fail = () => {
    stop()
    opts.onFail?.()
  }
  const context = canvas.getContext('webgl2', {
    ...CONTEXT,
    powerPreference: 'high-performance',
  })
  let stopped = false
  let raf = 0
  const cleanups: (() => void)[] = []
  function stop() {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(raf)
    for (const fn of cleanups) fn()
    freeAll()
    delete canvas.dataset.ready
    // the canvas has left the page: give the browser its context back
    if (!canvas.isConnected) {
      context?.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }
  const textures = new Set<WebGLTexture>()
  const framebuffers = new Set<WebGLFramebuffer>()
  const programs = new Set<Program>()
  function freeAll() {
    if (!context) return
    for (const t of textures) context.deleteTexture(t)
    for (const f of framebuffers) context.deleteFramebuffer(f)
    for (const pr of programs) {
      for (const s of pr.shaders) context.deleteShader(s)
      context.deleteProgram(pr.p)
    }
    textures.clear()
    framebuffers.clear()
    programs.clear()
  }
  if (!context || !context.getExtension('EXT_color_buffer_float')) {
    queueMicrotask(() => opts.onFail?.())
    return { stop }
  }
  const gl = context
  const parallel = gl.getExtension('KHR_parallel_shader_compile')
  gl.bindVertexArray(gl.createVertexArray())
  gl.disable(gl.DEPTH_TEST)
  gl.disable(gl.BLEND)
  gl.disable(gl.DITHER)
  gl.disable(gl.SCISSOR_TEST)

  function program(fragment: string): Program {
    const p = gl.createProgram()
    const shaders = (
      [
        [gl.VERTEX_SHADER, VERTEX],
        [gl.FRAGMENT_SHADER, fragment],
      ] as const
    ).map(([type, source]) => {
      const s = gl.createShader(type)
      if (!s) throw new Error('no shader')
      gl.shaderSource(s, source)
      gl.compileShader(s)
      gl.attachShader(p, s)
      return s
    })
    gl.linkProgram(p)
    const known = new Map<string, WebGLUniformLocation | null>()
    const pr: Program = {
      p,
      shaders,
      u: (name) => {
        if (!known.has(name)) known.set(name, gl.getUniformLocation(p, name))
        return known.get(name) ?? null
      },
    }
    programs.add(pr)
    return pr
  }
  function linked(pr: Program) {
    if (gl.getProgramParameter(pr.p, gl.LINK_STATUS)) return true
    // eslint-disable-next-line no-console
    console.error(
      pr.shaders.map((s) => gl.getShaderInfoLog(s)).join(''),
      gl.getProgramInfoLog(pr.p)
    )
    return false
  }
  function texture(w: number, h: number, format: number, filter: number) {
    const t = gl.createTexture()
    textures.add(t)
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texStorage2D(gl.TEXTURE_2D, 1, format, w, h)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }
  function framebuffer() {
    const f = gl.createFramebuffer()
    framebuffers.add(f)
    return f
  }
  function target(w: number, h: number, format: number = gl.R11F_G11F_B10F) {
    const tex = texture(w, h, format, gl.LINEAR)
    const fb = framebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0
    )
    return { tex, fb, w, h }
  }
  function dropTarget(t: Target) {
    gl.deleteTexture(t.tex)
    gl.deleteFramebuffer(t.fb)
    textures.delete(t.tex)
    framebuffers.delete(t.fb)
  }
  function bind(unit: number, tex: WebGLTexture, pr: Program, name: string) {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(pr.u(name), unit)
  }
  const triangle = () => gl.drawArrays(gl.TRIANGLES, 0, 3)
  function mipmapped(wrapT: number) {
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT)
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }

  let geom!: Program
  let ring!: Program
  let earthPr!: Program
  let flow!: Program
  let wakePr!: Program
  let down!: Program
  let up!: Program
  let fin!: Program
  let noiseTex!: WebGLTexture
  let earthTex!: WebGLTexture
  let skyTex!: WebGLTexture

  // ------------------------------------------------------- targets, by size
  let bloom: {
    w: number
    h: number
    main: Target
    down: Target[]
    up: Target[]
  } | null = null
  function sizeBloom(w: number, h: number) {
    if (bloom?.w === w && bloom.h === h) return
    if (bloom) {
      dropTarget(bloom.main)
      bloom.down.forEach(dropTarget)
      bloom.up.forEach(dropTarget)
    }
    const d: Target[] = []
    const u: Target[] = []
    let cw = w
    let ch = h
    for (let i = 0; i < LEVELS; i++) {
      cw = Math.max(2, cw >> 1)
      ch = Math.max(2, ch >> 1)
      d.push(target(cw, ch))
      u.push(target(cw, ch))
    }
    bloom = { w, h, main: target(w, h), down: d, up: u }
    bloomFresh = true
  }

  // ------------------------------------------------- worked out once, strips
  function* bake(w: number, h: number): Generator<void, Baked> {
    const g = [
      texture(w, h, gl.RG32F, gl.NEAREST),
      texture(w, h, gl.RG32F, gl.NEAREST),
      texture(w, h, gl.RGBA16F, gl.NEAREST),
      texture(w, h, gl.RGBA16F, gl.NEAREST),
    ]
    const fb = framebuffer()
    const ringFb = framebuffer()
    for (let i = 0; i < BAKE_ROWS; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      g.forEach((t, n) =>
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0 + n,
          gl.TEXTURE_2D,
          t,
          0
        )
      )
      gl.drawBuffers(g.map((_, n) => gl.COLOR_ATTACHMENT0 + n))
      gl.viewport(0, 0, w, h)
      gl.useProgram(geom.p)
      bind(0, noiseTex, geom, 'uTex')
      bind(1, skyTex, geom, 'uSky')
      gl.uniform2f(geom.u('uRes'), w, h)
      gl.uniform3f(geom.u('uView'), HOLE.x, HOLE.y, FRAME_ASPECT)
      gl.uniform1f(geom.u('uT'), 40)
      gl.enable(gl.SCISSOR_TEST)
      gl.scissor(
        0,
        Math.floor((h * i) / BAKE_ROWS),
        w,
        Math.ceil(h / BAKE_ROWS)
      )
      triangle()
      gl.bindFramebuffer(gl.FRAMEBUFFER, ringFb)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        g[3],
        0
      )
      gl.useProgram(ring.p)
      bind(0, noiseTex, ring, 'uTex')
      gl.uniform2f(ring.u('uRes'), w, h)
      gl.uniform3f(ring.u('uView'), HOLE.x, HOLE.y, FRAME_ASPECT)
      gl.uniform1f(ring.u('uT'), 40)
      triangle()
      gl.disable(gl.SCISSOR_TEST)
      gl.flush()
      yield
    }
    gl.deleteFramebuffer(ringFb)
    framebuffers.delete(ringFb)
    // the Earth is a small part of the screen: its own small picture
    const box = earthBox(w, h)
    const ew = Math.max(1, box[2] - box[0])
    const eh = Math.max(1, box[3] - box[1])
    const earth = target(ew, eh, gl.RGBA16F)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, earth.fb)
    gl.viewport(0, 0, ew, eh)
    gl.useProgram(earthPr.p)
    bind(0, earthTex, earthPr, 'uEarth')
    gl.uniform2f(earthPr.u('uRes'), w, h)
    gl.uniform2f(earthPr.u('uOff'), box[0], box[1])
    gl.uniform2f(earthPr.u('uHole'), HOLE.x, HOLE.y)
    gl.uniform3f(earthPr.u('uEarthP'), EARTH.x, EARTH.y, EARTH.r)
    gl.uniform3f(earthPr.u('uLook'), ...EARTH_LOOK)
    gl.uniform1f(earthPr.u('uAsp'), FRAME_ASPECT)
    triangle()
    gl.flush()
    yield
    return { w, h, g, fb, earth, box }
  }
  function dropBaked(b: Baked) {
    for (const t of b.g) {
      gl.deleteTexture(t)
      textures.delete(t)
    }
    gl.deleteFramebuffer(b.fb)
    framebuffers.delete(b.fb)
    dropTarget(b.earth)
  }

  // ------------------------------------------------------------ the pointer
  const ptr = { x: -1e4, y: -1e4, inside: false, lastX: -1e4, lastY: -1e4 }
  let kick = 0
  let presence = 0
  let box = canvas.getBoundingClientRect()
  let boxStale = false
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    ptr.x = e.clientX
    ptr.y = e.clientY
    // a dialog over the sky has the pointer to itself
    ptr.inside = !(e.target as Element | null)?.closest?.('[role=dialog]')
  }
  const onLeave = () => {
    ptr.inside = false
  }
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    const el = e.target as Element | null
    if (!el?.closest?.('a,button,input,[role=dialog]')) kick = 0.9
  }
  const onScroll = () => {
    boxStale = true
  }
  const listen = { passive: true } as const
  window.addEventListener('pointermove', onMove, listen)
  window.addEventListener('pointerdown', onDown, listen)
  window.addEventListener('blur', onLeave)
  window.addEventListener('scroll', onScroll, listen)
  document.documentElement.addEventListener('pointerleave', onLeave, listen)
  cleanups.push(() => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerdown', onDown)
    window.removeEventListener('blur', onLeave)
    window.removeEventListener('scroll', onScroll)
    document.documentElement.removeEventListener('pointerleave', onLeave)
  })

  // ---------------------------------------------------------- the stirred gas
  let wakes: [Target, Target] | null = null
  let wakeUntil = 0
  let wakeLive = false
  function wakeTarget() {
    const t = target(WAKE_W, WAKE_H, gl.R16F)
    gl.bindTexture(gl.TEXTURE_2D, t.tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return t
  }
  function stepWake(b: Baked, t: number, dt: number, near: number) {
    const moved = Math.hypot(ptr.x - ptr.lastX, ptr.y - ptr.lastY)
    ptr.lastX = ptr.x
    ptr.lastY = ptr.y
    const speed = dt > 0 ? moved / dt : 0
    let amount = 0
    let width = 0.55
    if (near > 0.02 && presence > 0.02) {
      amount =
        (0.012 + 0.09 * Math.min(speed / 1400, 1)) * (dt * 60) * presence * near
      if (kick) {
        amount += kick * near
        width = 0.75
      }
      wakeUntil = t + WAKE_RUN
    }
    kick = 0
    wakeLive = t < wakeUntil
    if (!wakeLive) return
    wakes ??= [wakeTarget(), wakeTarget()]
    const sx = b.w / box.width
    gl.bindFramebuffer(gl.FRAMEBUFFER, wakes[1].fb)
    gl.viewport(0, 0, WAKE_W, WAKE_H)
    gl.useProgram(wakePr.p)
    bind(0, wakes[0].tex, wakePr, 'uPrev')
    bind(1, b.g[0], wakePr, 'uG0')
    gl.uniform2f(wakePr.u('uR'), WAKE_W, WAKE_H)
    gl.uniform4f(
      wakePr.u('uStep'),
      dt,
      FLOW_SPEED,
      Math.exp(-dt / WAKE_FADE),
      INWARD_DRIFT
    )
    gl.uniform2i(
      wakePr.u('uPtr'),
      Math.max(0, Math.min(b.w - 1, Math.round((ptr.x - box.left) * sx))),
      Math.max(0, Math.min(b.h - 1, Math.round(b.h - (ptr.y - box.top) * sx)))
    )
    gl.uniform2f(wakePr.u('uSrc'), width, amount)
    triangle()
    wakes = [wakes[1], wakes[0]]
  }

  // ------------------------------------------------------------ one frame
  // the bloom every other frame, down then up: nobody sees it a frame late
  let bloomOdd = false
  let bloomFresh = true
  function draw(b: Baked, t: number, near: number) {
    const R = bloom
    if (!R) return
    const sx = b.w / box.width
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.main.fb)
    gl.viewport(0, 0, b.w, b.h)
    gl.useProgram(flow.p)
    bind(0, noiseTex, flow, 'uTex')
    bind(1, b.g[0], flow, 'uG0')
    bind(2, b.g[1], flow, 'uG1')
    bind(3, b.g[2], flow, 'uG2')
    bind(4, b.g[3], flow, 'uG3')
    bind(5, b.earth.tex, flow, 'uE')
    bind(6, wakeLive && wakes ? wakes[0].tex : noiseTex, flow, 'uWake')
    gl.uniform1f(flow.u('uHot'), wakeLive ? 1 : 0)
    gl.uniform1f(flow.u('uT'), t)
    gl.uniform4i(flow.u('uBox'), b.box[0], b.box[1], b.box[2], b.box[3])
    gl.uniform2i(flow.u('uSize'), b.w, b.h)
    gl.uniform4f(
      flow.u('uLens'),
      (ptr.x - box.left) * sx,
      b.h - (ptr.y - box.top) * sx,
      POINTER_LENS * sx,
      presence * near
    )
    triangle()
    if (bloomFresh || !bloomOdd) {
      gl.useProgram(down.p)
      let src = R.main
      R.down.forEach((c, i) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, c.fb)
        gl.viewport(0, 0, c.w, c.h)
        bind(0, src.tex, down, 'uS')
        gl.uniform2f(down.u('uPx'), 1 / c.w, 1 / c.h)
        gl.uniform1f(down.u('uThr'), i === 0 ? 1 : 0)
        triangle()
        src = c
      })
    }
    if (bloomFresh || bloomOdd) {
      gl.useProgram(up.p)
      let src = R.down[LEVELS - 1]
      for (let i = LEVELS - 2; i >= 0; i--) {
        const c = R.up[i]
        gl.bindFramebuffer(gl.FRAMEBUFFER, c.fb)
        gl.viewport(0, 0, c.w, c.h)
        bind(0, src.tex, up, 'uS')
        bind(1, R.down[i].tex, up, 'uAdd')
        gl.uniform2f(up.u('uPx'), 1 / c.w, 1 / c.h)
        gl.uniform1f(up.u('uMix'), 0.72)
        triangle()
        src = c
      }
    }
    bloomOdd = !bloomOdd
    bloomFresh = false
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, b.w, b.h)
    gl.useProgram(fin.p)
    bind(0, R.main.tex, fin, 'uS')
    bind(1, R.up[0].tex, fin, 'uB')
    gl.uniform2f(fin.u('uRes'), b.w, b.h)
    gl.uniform1f(fin.u('uT'), t)
    gl.uniform1f(fin.u('uGrain'), 0.011)
    triangle()
  }

  // --------------------------------------------------------- getting ready
  function* boot(): Generator<void, void> {
    geom = program(GEOM)
    ring = program(RING)
    earthPr = program(EARTH_FS)
    flow = program(FLOW)
    wakePr = program(WAKE)
    down = program(DOWN)
    up = program(UP)
    fin = program(FINAL)
    const noisePr = program(BAKE_DISK)
    const all = [geom, ring, earthPr, flow, wakePr, down, up, fin, noisePr]
    gl.flush()
    while (
      parallel &&
      !all.every((pr) =>
        gl.getProgramParameter(pr.p, parallel.COMPLETION_STATUS_KHR)
      )
    ) {
      yield
    }
    if (!all.every(linked)) throw new Error('shaders')

    const earthImg = new Image()
    const skyImg = new Image()
    earthImg.src = ASSETS.earth
    skyImg.src = ASSETS.sky
    let loaded: boolean | undefined
    Promise.all([earthImg.decode(), skyImg.decode()])
      .then(() => (loaded = true))
      .catch(() => (loaded = false))
    while (loaded === undefined) yield
    if (!loaded) throw new Error('pictures')
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    earthTex = gl.createTexture()
    textures.add(earthTex)
    gl.bindTexture(gl.TEXTURE_2D, earthTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, earthImg)
    mipmapped(gl.CLAMP_TO_EDGE)
    yield
    // always drawn larger than it is: no mipmaps
    skyTex = gl.createTexture()
    textures.add(skyTex)
    gl.bindTexture(gl.TEXTURE_2D, skyTex)
    // r, g and b are data, not colour: no colour-profile conversion on the way in
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, skyImg)
    gl.pixelStorei(
      gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,
      gl.BROWSER_DEFAULT_WEBGL
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    yield

    noiseTex = gl.createTexture()
    textures.add(noiseTex)
    gl.bindTexture(gl.TEXTURE_2D, noiseTex)
    gl.texStorage2D(
      gl.TEXTURE_2D,
      Math.floor(Math.log2(NOISE_W)) + 1,
      gl.RGBA8,
      NOISE_W,
      NOISE_H
    )
    const nf = gl.createFramebuffer()
    for (let i = 0; i < NOISE_ROWS; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, nf)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        noiseTex,
        0
      )
      gl.viewport(0, 0, NOISE_W, NOISE_H)
      gl.useProgram(noisePr.p)
      gl.uniform2f(noisePr.u('uRes'), NOISE_W, NOISE_H)
      gl.enable(gl.SCISSOR_TEST)
      gl.scissor(0, (i * NOISE_H) / NOISE_ROWS, NOISE_W, NOISE_H / NOISE_ROWS)
      triangle()
      gl.disable(gl.SCISSOR_TEST)
      gl.flush()
      yield
    }
    gl.deleteFramebuffer(nf)
    gl.bindTexture(gl.TEXTURE_2D, noiseTex)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }

  // --------------------------------------------------------------- the loop
  let booting: Generator<void, void> | null = boot()
  let baking: Generator<void, Baked> | null = null
  let bakingSize: [number, number] = [0, 0]
  let current: Baked | null = null
  let quality = 1
  let visible = !document.hidden
  let inView = true
  let last = 0
  let first = true
  // the screen's own pace, from a dozen ticks with nothing drawn
  const ticks: number[] = []
  let tickAt = 0
  let vsync = 16.67
  let pace = newPace(vsync)
  const startedAt = performance.now()

  function rebake() {
    const r = canvas.getBoundingClientRect()
    const [w, h] = canvasSize(
      r.width,
      r.height,
      window.devicePixelRatio || 1,
      quality
    )
    if (current?.w === w && current.h === h) return
    baking = bake(w, h)
    bakingSize = [w, h]
  }
  function loop(now: number) {
    if (stopped) return
    raf = requestAnimationFrame(loop)
    if (!visible || !inView) {
      last = 0
      return
    }
    if (ticks.length < 14) {
      if (tickAt) ticks.push(now - tickAt)
      tickAt = now
      if (ticks.length === 14) {
        vsync = [...ticks].sort((a, b) => a - b)[7]
        pace = newPace(vsync)
      }
      return
    }
    // measured every time: the window can move to a screen with another rate
    const refresh = now - tickAt
    tickAt = now
    try {
      if (booting) {
        if (booting.next().done) {
          booting = null
          rebake()
        }
        return
      }
      if (baking) {
        const step = baking.next()
        if (step.done) {
          baking = null
          if (current) dropBaked(current)
          current = step.value
          const [w, h] = bakingSize
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w
            canvas.height = h
          }
          sizeBloom(w, h)
          // a frame now, or the resized canvas shows blank until the next one
          last = 0
          // the window may have changed again while this one baked: a resize
          // then skips its rebake, so look now (nothing if the size held)
          rebake()
        } else if (!current) return
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      fail()
      return
    }
    if (!current) return
    if (boxStale) {
      box = canvas.getBoundingClientRect()
      boxStale = false
    }
    const near = ptr.inside
      ? gravityAt(ptr.x - box.left, ptr.y - box.top, box.width, box.height)
      : 0
    // about 60 a second, unless the pointer is on the hole
    const onHole = near > 0.01
    if (!onHole && last && !frameDue(now - last, refresh)) return
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016
    const gap = last ? now - last : 0
    last = now
    presence +=
      ((ptr.inside ? 1 : 0) - presence) * (1 - Math.pow(0.82, dt * 60))
    if (presence < 0.001) presence = 0
    const t = ((now - startedAt) / 1000 + 40) % 3600
    gl.disable(gl.BLEND)
    stepWake(current, t, dt, near)
    draw(current, t, near)
    if (first) {
      first = false
      canvas.dataset.ready = '1'
    }
    opts.onFrame?.()
    if (gap > 0 && !baking) {
      const verdict = paceFrame(pace, gap, quality)
      if (verdict === 'lower') {
        quality = Math.max(QUALITY_MIN, quality * QUALITY_STEP)
        rebake()
      } else if (verdict === 'raise') {
        quality = Math.min(1, quality / QUALITY_STEP)
        rebake()
      } else if (verdict === 'freeze') {
        // the same picture holds still, and the GPU is free
        fail()
      }
    }
  }

  const onVisibility = () => {
    visible = !document.hidden
    last = 0
    if (ticks.length < 14) {
      ticks.length = 0
      tickAt = 0
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  const seen = new IntersectionObserver((entries) => {
    inView = entries.at(-1)?.isIntersecting ?? inView
    last = 0
  })
  seen.observe(canvas)
  // the window settled on a new size: work it out, swap when done; until then
  // the old picture stretches
  let settle = 0
  const resized = new ResizeObserver(() => {
    boxStale = true
    window.clearTimeout(settle)
    settle = window.setTimeout(() => {
      if (!booting && !baking && !stopped) rebake()
    }, 220)
  })
  resized.observe(canvas)
  const onLost = (e: Event) => {
    e.preventDefault()
    fail()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  cleanups.push(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    seen.disconnect()
    resized.disconnect()
    window.clearTimeout(settle)
    canvas.removeEventListener('webglcontextlost', onLost)
  })
  opts.signal.addEventListener('abort', stop, { once: true })
  raf = requestAnimationFrame(loop)
  return { stop }
}
