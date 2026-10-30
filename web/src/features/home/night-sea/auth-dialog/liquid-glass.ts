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
 * Liquid glass for the sign-in dialog. The home page paints its own sky, so
 * the glass refracts it directly: each frame the patch of sky behind the card
 * is copied into a texture and a shader bends it through a thick, rounded
 * slab — rim refraction with a little dispersion, a specular edge that turns
 * towards the pointer, and a soft bezel for thickness. Works in every browser
 * with WebGL, unlike an SVG filter on backdrop-filter (Chromium only).
 */

const VERTEX = `attribute vec2 p; varying vec2 uv;
void main() { uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`

const FRAGMENT = `precision highp float;
varying vec2 uv;
uniform sampler2D sky;
uniform vec2 size;      // card, CSS px
uniform vec2 texSize;   // captured patch, CSS px (card on screen + margin)
uniform float margin, scale, radius, bezel, refract, disperse, blur;
uniform vec2 light;     // unit vector from the card's centre towards the light

float box(vec2 p) {
  vec2 q = abs(p) - size * .5 + radius;
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - radius;
}
vec3 at(vec2 px) { return texture2D(sky, (px * scale + margin) / texSize).rgb; }
vec3 soft(vec2 px) {
  vec3 c = at(px) * .2;
  c += (at(px + vec2(blur, 0.)) + at(px - vec2(blur, 0.)) + at(px + vec2(0., blur)) + at(px - vec2(0., blur))) * .12;
  vec2 d = vec2(blur * .7);
  c += (at(px + d) + at(px - d) + at(px + vec2(d.x, -d.y)) + at(px + vec2(-d.x, d.y))) * .08;
  return c;
}
void main() {
  vec2 px = uv * size;
  vec2 c = px - size * .5;
  float sd = box(c);
  vec2 n = normalize(vec2(box(c + vec2(1., 0.)) - box(c - vec2(1., 0.)),
                          box(c + vec2(0., 1.)) - box(c - vec2(0., 1.))) + 1e-5);
  float d = max(-sd, 0.);                 // depth inside the edge
  float s = clamp(d / bezel, 0., 1.);     // 0 at the rim, 1 where the slab goes flat
  float edge = 1. - s;

  // A rounded bezel bends light inwards: the rim shows sky from further in,
  // squeezed; the flat middle magnifies a touch. Only the rim splits colours.
  vec2 bend = -n * refract * pow(edge, 1.7);
  vec2 at0 = px - c * .045;
  float r = soft(at0 + bend * (1. + disperse)).r;
  float g = soft(at0 + bend).g;
  float b = soft(at0 + bend * (1. - disperse)).b;
  vec3 col = vec3(r, g, b);

  // Glass gathers light: a little brighter and more saturated than the sky around it.
  float l = dot(col, vec3(.299, .587, .114));
  col = max(mix(vec3(l), col, 1.45) * 1.25, 0.) + vec3(.020, .026, .042);
  // Body: a cool tint, deeper towards the middle, so the form stays legible.
  col = mix(col, vec3(.035, .045, .08), .16 + .12 * s);

  // Thickness: the bezel catches a soft glow, then a faint shadow where it meets the flat.
  col += vec3(.62, .68, .82) * pow(edge, 2.6) * .16;
  col *= 1. - .14 * exp(-pow((d - bezel * 1.05) / (bezel * .35), 2.));

  // Specular: a hairline that blazes on the edge facing the light,
  // and a fainter one opposite, reflected inside the slab.
  float facing = dot(n, light);
  float key = pow(max(facing, 0.), 2.2);
  float back = pow(max(-facing, 0.), 2.6) * .5;
  float line = exp(-d / 1.1);
  float sheen = exp(-d / 7.) * .32;
  col += vec3(1., .98, .95) * ((line + sheen) * (key + back) + line * .14);

  float a = clamp(.5 - sd, 0., 1.);
  gl_FragColor = vec4(col * a, a);
}`

const UNIFORMS = [
  'size',
  'texSize',
  'margin',
  'scale',
  'radius',
  'bezel',
  'refract',
  'disperse',
  'blur',
  'light',
] as const

/** Sky captured around the card, CSS px; every sample bends inwards, so only the blur reaches past the edge. */
const MARGIN = 8
/** Light from the upper left when nobody is pointing. */
const REST_ANGLE = -2.25

type LiquidGlassOptions = {
  /** The card the glass fills; its corner radius shapes the slab. */
  card: HTMLElement
  /** A canvas laid over the card, behind its content. */
  glass: HTMLCanvasElement
  /** The fully painted sky behind the card. */
  sky: HTMLCanvasElement
  /**
   * For a WebGL sky: calls back right after each of its frames, while the
   * picture can still be read (it is gone once the browser has shown it).
   * Without it the sky is read in this glass's own frame (a 2D sky).
   */
  skyFrames?: (fn: () => void) => () => void
  /** Called if the GPU drops the context, so the card can fall back to frosted glass. */
  onLost: () => void
}

/**
 * Starts drawing the glass; returns a function that stops and cleans up, or
 * null when WebGL is unavailable.
 */
export function startLiquidGlass(
  opts: LiquidGlassOptions
): (() => void) | null {
  const { card, glass, sky } = opts
  const gl = glass.getContext('webgl', {
    premultipliedAlpha: true,
    antialias: false,
  })
  if (!gl) return null

  const compile = (type: number, src: string) => {
    const shader = gl.createShader(type)
    if (!shader) throw new Error('createShader failed')
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed')
    }
    return shader
  }
  const program = gl.createProgram()
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'program link failed')
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Liquid glass unavailable', error)
    return null
  }
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  )
  const position = gl.getAttribLocation(program, 'p')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const u = Object.fromEntries(
    UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])
  ) as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>

  const captured = document.createElement('canvas')
  const captureCtx = captured.getContext('2d')
  if (!captureCtx) return null

  const phone = window.matchMedia('(max-width: 640px)')
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const pointer = { x: 0, y: 0, mouse: false }
  let angle = REST_ANGLE
  let radius = 32
  let raf = 0

  const measure = () => {
    radius = Number.parseFloat(getComputedStyle(card).borderTopLeftRadius) || 32
  }
  const onPointer = (e: PointerEvent) => {
    pointer.x = e.clientX
    pointer.y = e.clientY
    pointer.mouse = e.pointerType === 'mouse'
  }
  const onLeave = (e: MouseEvent) => {
    if (!e.relatedTarget) pointer.mouse = false
  }
  let unsubscribe: (() => void) | undefined
  const onLost = (e: Event) => {
    e.preventDefault()
    cancelAnimationFrame(raf)
    raf = 0
    unsubscribe?.()
    unsubscribe = undefined
    opts.onLost()
  }

  /**
   * Before the sky's first frame its poster shows under it (night-sea-home.tsx):
   * that patch of it, cropped as the page crops it (object-fit: cover)
   */
  function drawPoster(
    ctx: CanvasRenderingContext2D,
    css: { x: number; y: number; w: number; h: number },
    cw: number,
    ch: number
  ) {
    const img =
      sky.parentElement?.querySelector<HTMLImageElement>('.ns-sky-poster img')
    if (!img?.complete || !img.naturalWidth) return
    const box = img.getBoundingClientRect()
    if (!box.width || !box.height) return
    const [px = 0.5, py = 0.5] = getComputedStyle(img)
      .objectPosition.split(' ')
      .map((v) => (v.endsWith('%') ? Number.parseFloat(v) / 100 : 0.5))
    const s = Math.max(
      box.width / img.naturalWidth,
      box.height / img.naturalHeight
    )
    const ox = (box.width - img.naturalWidth * s) * px
    const oy = (box.height - img.naturalHeight * s) * py
    ctx.drawImage(
      img,
      (css.x - ox) / s,
      (css.y - oy) / s,
      css.w / s,
      css.h / s,
      0,
      0,
      cw,
      ch
    )
  }

  // The patch of sky behind the card, as it is on screen right now
  // (the card may be mid-animation, so use its transformed box).
  function capture(withSky = true) {
    if (!gl || !captureCtx) return
    const r = card.getBoundingClientRect()
    const skyBox = sky.getBoundingClientRect()
    if (!skyBox.width || !r.width) return
    const k = sky.width / skyBox.width
    const cw = Math.max(1, Math.round((r.width + 2 * MARGIN) * k))
    const ch = Math.max(1, Math.round((r.height + 2 * MARGIN) * k))
    if (captured.width !== cw || captured.height !== ch) {
      captured.width = cw
      captured.height = ch
    }
    captureCtx.fillStyle = '#04060d'
    captureCtx.fillRect(0, 0, cw, ch)
    let sx = (r.left - skyBox.left - MARGIN) * k
    let sy = (r.top - skyBox.top - MARGIN) * k
    let dx = 0
    let dy = 0
    if (sx < 0) {
      dx = -sx
      sx = 0
    }
    if (sy < 0) {
      dy = -sy
      sy = 0
    }
    const sw = Math.min(cw - dx, sky.width - sx)
    const sh = Math.min(ch - dy, sky.height - sy)
    if (withSky && sw > 0 && sh > 0) {
      captureCtx.drawImage(sky, sx, sy, sw, sh, dx, dy, sw, sh)
    } else if (!withSky) {
      drawPoster(
        captureCtx,
        {
          x: r.left - skyBox.left - MARGIN,
          y: r.top - skyBox.top - MARGIN,
          w: r.width + 2 * MARGIN,
          h: r.height + 2 * MARGIN,
        },
        cw,
        ch
      )
    }
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      captured
    )
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    const w = card.offsetWidth
    const h = card.offsetHeight
    if (!w || !h || !gl || !captureCtx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    if (glass.width !== bw || glass.height !== bh) {
      glass.width = bw
      glass.height = bh
    }
    gl.viewport(0, 0, bw, bh)
    if (!opts.skyFrames) capture()
    const r = card.getBoundingClientRect()

    // The highlight turns towards the pointer; left alone, the light drifts a little.
    let target = REST_ANGLE + (still ? 0 : 0.4 * Math.sin(now / 2600))
    if (pointer.mouse) {
      target = Math.atan2(
        pointer.y - (r.top + r.height / 2),
        pointer.x - (r.left + r.width / 2)
      )
    }
    angle +=
      Math.atan2(Math.sin(target - angle), Math.cos(target - angle)) *
      (still ? 1 : 0.07)

    const small = phone.matches
    gl.uniform2f(u.size, w, h)
    gl.uniform2f(u.texSize, r.width + 2 * MARGIN, r.height + 2 * MARGIN)
    gl.uniform1f(u.margin, MARGIN)
    gl.uniform1f(u.scale, r.width / w)
    gl.uniform1f(u.radius, radius)
    gl.uniform1f(u.bezel, small ? 20 : 26)
    gl.uniform1f(u.refract, small ? 20 : 26)
    gl.uniform1f(u.disperse, 0.11)
    gl.uniform1f(u.blur, 1.6)
    gl.uniform2f(u.light, Math.cos(angle), Math.sin(angle))
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  measure()
  window.addEventListener('resize', measure)
  window.addEventListener('pointermove', onPointer, { passive: true })
  document.addEventListener('mouseout', onLeave)
  glass.addEventListener('webglcontextlost', onLost)
  if (opts.skyFrames) {
    // its poster until the sky's first frame comes
    capture(false)
    unsubscribe = opts.skyFrames(() => capture())
  }
  raf = requestAnimationFrame(frame)

  return () => {
    unsubscribe?.()
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', measure)
    window.removeEventListener('pointermove', onPointer)
    document.removeEventListener('mouseout', onLeave)
    glass.removeEventListener('webglcontextlost', onLost)
  }
}
