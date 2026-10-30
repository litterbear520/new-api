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
// Whether the black hole can be drawn here. Small on purpose: the home page
// asks before it loads the engine (engine.ts, its own chunk).

export const CONTEXT: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  // a software renderer would crawl: then the still picture instead
  failIfMajorPerformanceCaveat: true,
}

/** The same breakpoints as the CSS (night-sea.css, black-hole.css): the phone's framing, and the gateway stacked (models above, tools below) */
export const PHONE_QUERY = '(max-width: 640px)'
export const STACKED_QUERY = '(max-width: 999px)'
const QUERIES = [PHONE_QUERY, STACKED_QUERY]

/** Which of the page's layouts is on now (a phone turned, a window resized): phones get the still picture, the gateway stacks */
export function layoutNow(): string {
  return QUERIES.map((q) => (window.matchMedia(q).matches ? '1' : '0')).join('')
}
export function subscribeLayout(onChange: () => void): () => void {
  const lists = QUERIES.map((q) => window.matchMedia(q))
  for (const l of lists) l.addEventListener('change', onChange)
  return () => {
    for (const l of lists) l.removeEventListener('change', onChange)
  }
}

let drawable: boolean | undefined

/** WebGL2 on a GPU, with float render targets. Asked once a page load. */
export function canDrawBlackHole(): boolean {
  if (drawable !== undefined) return drawable
  drawable = false
  try {
    const gl = document.createElement('canvas').getContext('webgl2', CONTEXT)
    if (gl) {
      drawable = !!gl.getExtension('EXT_color_buffer_float')
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    drawable = false
  }
  return drawable
}

/**
 * Calls fn the frame after the page's first contentful paint (at once, the
 * next frame, if that is long past): what decorates the page loads after its
 * words. Returns a function that cancels it.
 */
export function afterFirstPaint(fn: () => void): () => void {
  let raf = 0
  let timer = 0
  let observer: PerformanceObserver | null = null
  let done = false
  const go = () => {
    if (done) return
    done = true
    observer?.disconnect()
    window.clearTimeout(timer)
    raf = requestAnimationFrame(() => fn())
  }
  if (performance.getEntriesByName('first-contentful-paint').length) {
    go()
  } else {
    try {
      observer = new PerformanceObserver((list) => {
        if (list.getEntriesByName('first-contentful-paint').length) go()
      })
      observer.observe({ type: 'paint', buffered: true })
    } catch {
      // no paint timing: a moment after the first frames
    }
    // never wait long (a hidden tab paints nothing)
    timer = window.setTimeout(go, observer ? 1500 : 200)
  }
  return () => {
    done = true
    observer?.disconnect()
    window.clearTimeout(timer)
    cancelAnimationFrame(raf)
  }
}
