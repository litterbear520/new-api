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
import type { Ctx, NodeRec } from './context'
import { esc, h, reduced, report } from './dom'
import { ICONS } from './icons'
import { nRect, pub } from './query'

/*
 * What a picture shows: the image, the waiting slot (filled by the page's
 * renderPending) or the failed card with 重试. A finished picture comes in
 * over its waiting slot through the page's revealer, or with a blur-in.
 *
 * Level of detail: with a thumbnail, a picture shows it until it covers
 * more screen pixels than the thumbnail has; then (once the camera rests)
 * the full picture is decoded off the main thread and swapped in. It never
 * goes back down, so zooming out again costs nothing.
 */

/** The full picture takes over above this many screen px per thumbnail px. */
const SHARPEN_AT = 1.15
/** Before the thumbnail has decoded: its usual long side (draw/lib/images). */
const THUMB_LONG = 640

/** Waits for the image to decode (or fail), then calls done. */
async function whenDecoded(img: HTMLImageElement, done: () => void) {
  if (typeof img.decode !== 'function') {
    img.addEventListener('load', done, { once: true })
    img.addEventListener('error', done, { once: true })
    return
  }
  try {
    await img.decode()
  } catch {
    // A broken picture still replaces the waiting slot.
  }
  done()
}

export function createMedia(c: Ctx) {
  /** Is the thumbnail too small for the picture's size on screen? */
  function wantsFull(n: NodeRec): boolean {
    const thumbW =
      n.thumbW || n.w * Math.min(1, THUMB_LONG / Math.max(n.w, n.h))
    const px = n.dw * c.cam.s * (window.devicePixelRatio || 1)
    return px > thumbW * SHARPEN_AT
  }

  /** Which file a finished picture should show now. */
  function pick(n: NodeRec): string | null {
    if (!n.src || !n.thumb || n.shown === n.src) return n.src
    // A saved state is loading and the camera isn't final: start small.
    if (c.restoring) return n.thumb
    return wantsFull(n) ? n.src : n.thumb
  }

  function hook(n: NodeRec) {
    if (!c.o.onRendered) return
    try {
      c.o.onRendered(n.el, pub(n))
    } catch (err) {
      report(err)
    }
  }

  async function revealOver(
    n: NodeRec,
    img: HTMLImageElement,
    old: Element[],
    token: number
  ) {
    try {
      await c.o.revealer?.(n.media, img, old, pub(n))
    } catch {
      // The picture is in place either way.
    }
    if (n.tok === token) for (const x of old) x.remove()
  }

  function showImage(n: NodeRec, src: string, animateIn: boolean) {
    const m = n.media
    const token = n.tok
    const img = new Image()
    img.className = 'bd-cv-img'
    img.alt = n.label
    img.draggable = false
    img.decoding = 'async'
    n.want = src
    const done = () => {
      if (n.tok !== token || n.dead) return
      n.want = null
      n.shown = src
      if (src === n.thumb) n.thumbW = img.naturalWidth
      // The camera may have zoomed in (or come to rest) while it decoded.
      if (src === n.thumb && !c.d.el.classList.contains('is-moving')) {
        queueMicrotask(() => sharpenNode(n))
      }
      n.imgEl = img
      m.className = 'bd-cv-media is-ready'
      const animate = animateIn && !reduced()
      if (animate && c.o.revealer) {
        const old = [...m.children]
        m.append(img)
        void revealOver(n, img, old, token)
      } else if (animate) {
        const old = [...m.children]
        img.classList.add('bd-cv-reveal')
        m.append(img)
        img.addEventListener(
          'animationend',
          () => {
            img.classList.remove('bd-cv-reveal')
            for (const x of old) x.remove()
          },
          { once: true }
        )
      } else {
        m.replaceChildren(img)
      }
      hook(n)
    }
    img.src = src
    void whenDecoded(img, done)
  }

  function failedCard(n: NodeRec): string {
    const L = c.L
    const label = n.label ? `<b>${esc(n.label)}</b>` : ''
    return `<div class="bd-cv-failed"><span class="bd-cv-failed-ic">${ICONS.imageOff}</span>${label}<span>${esc(L.failedNote)}</span><button type="button" class="bd-cv-retry" data-cv-retry>${ICONS.retry}<span>${esc(L.retry)}</span></button></div>`
  }

  function pendingSlot(n: NodeRec) {
    const m = n.media
    m.className = 'bd-cv-media is-pending'
    const slot = h('div', 'bd-cv-pending-slot')
    m.replaceChildren(h('div', 'bd-cv-shimmer'), slot)
    if (c.o.renderPending) {
      try {
        c.o.renderPending(slot, pub(n))
      } catch (err) {
        report(err)
      }
      return
    }
    const label = n.label ? `<div class="bd-cv-pd-l">${esc(n.label)}</div>` : ''
    slot.innerHTML = `<div class="bd-cv-pd"><div class="bd-cv-pd-dots"><i></i><i></i><i></i></div><div class="bd-cv-pd-t">${esc(c.L.drawing)}</div>${label}</div>`
  }

  /** Draws the picture's content for its status; `animateIn` brings it in. */
  function renderMedia(n: NodeRec, animateIn: boolean) {
    n.el.dataset.status = n.status
    n.tok += 1
    const src = n.status === 'ready' ? pick(n) : null
    if (src) {
      if (n.shown === src) {
        n.want = null
        hook(n)
        return
      }
      showImage(n, src, animateIn)
      return
    }
    n.shown = null
    n.want = null
    n.imgEl = null
    if (n.status === 'failed') {
      n.media.className = 'bd-cv-media is-failed'
      n.media.innerHTML = failedCard(n)
    } else {
      pendingSlot(n)
    }
    hook(n)
  }

  /** The full picture, if its thumbnail is on screen and looks soft. */
  function sharpenNode(n: NodeRec) {
    if (n.dead || n.status !== 'ready' || !n.src || n.shown !== n.thumb) return
    if (n.want === n.src || !wantsFull(n)) return
    const r = nRect(c, n)
    if (r.x > c.W || r.y > c.H || r.x + r.w < 0 || r.y + r.h < 0) return
    n.tok += 1
    showImage(n, n.src, false)
  }

  /** After the camera rests: full pictures where thumbnails look soft. */
  function sharpen() {
    for (const n of c.nodes.values()) sharpenNode(n)
  }

  return { renderMedia, sharpen }
}
