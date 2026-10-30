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
import { t } from 'i18next'

import { TYPICAL_DEFAULT, TYPICAL_SECS } from '../constants'
import { reduced } from './canvas/dom'

/*
 * 「点阵显影」: a waiting picture is a fine dot screen over two slow colour
 * blobs, with an honest status word and a clock. When the picture comes, it
 * goes under the screen and the screen lifts away, like a print developing.
 * Only transform and opacity animate (css/halftone.css).
 */

export type HalftoneOptions = {
  /** When drawing started (ms); default now. */
  startedAt?: number
  model?: string
  /** An edit of a picture (edits take longer). */
  edit?: boolean
  /** Index among its siblings, so the blobs don't move in step. */
  i?: number
  /** Finer dots for small tiles. */
  small?: boolean
  /** Waiting for a free drawing slot. */
  queued?: boolean
}

export type HalftoneHandle = {
  setStarted: (ms: number) => void
  setQueued: (queued: boolean) => void
  /** Puts the picture under the screen and lifts the screen; then the picture replaces it. */
  reveal: (img: HTMLImageElement) => Promise<void>
  destroy: () => void
}

/** Where a picture is, from its time so far against the model's p50/p90. */
export type HalftonePhase = 'start' | 'details' | 'finish' | 'slow'

export function halftonePhase(
  secs: number,
  model?: string,
  edit?: boolean
): HalftonePhase {
  const typical = (model && TYPICAL_SECS[model]) || TYPICAL_DEFAULT
  const [p50, p90] = edit ? typical.edit : typical.gen
  if (secs > p90 * 1.5) return 'slow'
  if (secs < 8) return 'start'
  if (secs < Math.max(20, p50 + 5)) return 'details'
  return 'finish'
}

export function halftoneClock(secs: number): string {
  const s = Math.max(0, secs)
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function phaseWord(phase: HalftonePhase): string {
  switch (phase) {
    case 'slow':
      return t('Slower than usual, still drawing')
    case 'start':
      return t('Starting')
    case 'details':
      return t('Adding details')
    default:
      return t('Finishing up')
  }
}

/* One ticker for every dot screen on the page. */
const live = new Set<() => void>()
let ticker = 0

function track(paint: () => void) {
  live.add(paint)
  if (!ticker) {
    ticker = window.setInterval(() => {
      for (const f of live) f()
    }, 1000)
  }
}

function untrack(paint: () => void) {
  live.delete(paint)
  if (live.size || !ticker) return
  window.clearInterval(ticker)
  ticker = 0
}

const div = (cls: string) => {
  const e = document.createElement('div')
  e.className = cls
  return e
}

export function mountHalftone(
  el: HTMLElement,
  opts: HalftoneOptions = {}
): HalftoneHandle {
  let started = opts.startedAt || Date.now()
  let queued = !!opts.queued
  const root = div(opts.small ? 'bd-ht bd-ht-sm' : 'bd-ht')
  root.style.setProperty('--bd-ht-i', String(opts.i ?? 0))
  const dots = div('bd-ht-dots')
  const status = div('bd-ht-st')
  const word = document.createElement('b')
  word.className = 'bd-ht-w'
  const clock = document.createElement('span')
  clock.className = 'bd-ht-t'
  status.append(word, clock)
  root.append(
    div('bd-ht-l0'),
    div('bd-ht-blob'),
    div('bd-ht-blob is-b'),
    dots,
    status
  )
  el.append(root)

  const paint = () => {
    const secs = (Date.now() - started) / 1000
    const w = queued
      ? t('Queued')
      : phaseWord(halftonePhase(secs, opts.model, opts.edit))
    if (word.textContent !== w) word.textContent = w
    const time = queued ? '' : halftoneClock(secs)
    if (clock.textContent !== time) clock.textContent = time
  }
  paint()
  track(paint)

  // Off screen the blobs and the shine pause.
  let io: IntersectionObserver | null = null
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((entries) => {
      const e = entries.at(-1)
      if (e) root.classList.toggle('is-off', !e.isIntersecting)
    })
    io.observe(root)
  }
  const stop = () => {
    untrack(paint)
    io?.disconnect()
    io = null
  }

  return {
    setStarted(ms) {
      started = ms || Date.now()
      queued = false
      paint()
    },
    setQueued(q) {
      queued = q
      paint()
    },
    reveal(img) {
      stop()
      return new Promise<void>((resolve) => {
        if (reduced()) {
          root.remove()
          resolve()
          return
        }
        img.classList.add('bd-ht-final')
        dots.before(img)
        requestAnimationFrame(() => root.classList.add('is-rev'))
        window.setTimeout(() => {
          img.classList.remove('bd-ht-final')
          root.before(img)
          root.remove()
          resolve()
        }, 900)
      })
    },
    destroy() {
      stop()
      root.remove()
    },
  }
}
