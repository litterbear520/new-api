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
import type { LensNote } from './handoff'
import { springTo, type Spring } from './morph'

/** Where the lens's two edges stand, in px from the links' left, and how fast they move. */
export type Edges = LensNote

/** A stretch of the links' row, in px from its left. */
export type Span = { left: number; right: number }

// The lens's two edges move on their own springs, the leading one quicker:
// it stretches on the way and lands with a small bounce.
const LEAD: Spring = { stiffness: 600, damping: 32 }
const TRAIL: Spring = { stiffness: 170, damping: 22 }
// Under a finger it keeps up, and still stretches the way it goes.
const FOLLOW_LEAD: Spring = { stiffness: 900, damping: 50 }
const FOLLOW_TRAIL: Spring = { stiffness: 380, damping: 32 }

/** Held, the lens swells like a drop of water lifted off the bar. */
export const SWOLLEN = 1.2
const SWELL: Spring = { stiffness: 420, damping: 22 }

/** Stretched past the wider of its two links, the lens thins like a drop. */
const SQUASH = 0.3
const MAX_SQUASH = 0.14

/** Past the first and last links a dragged lens follows at this rate. */
const RUBBER = 0.3

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const centre = (span: Span) => (span.left + span.right) / 2

/**
 * The lens under a finger at `x`: centred on it and as wide as the links it
 * is between, held back like rubber past the first and last.
 */
export function lensAt(spans: Span[], x: number): Span {
  const centres = spans.map(centre)
  const first = centres[0]
  const last = centres.at(-1) ?? first
  let at = x
  if (at < first) at = first - (first - at) * RUBBER
  else if (at > last) at = last + (at - last) * RUBBER
  const widths = spans.map((span) => span.right - span.left)
  let width = (at <= first ? widths[0] : widths.at(-1)) ?? 0
  for (let i = 0; i < centres.length - 1; i++) {
    if (at >= centres[i] && at <= centres[i + 1]) {
      const t = (at - centres[i]) / (centres[i + 1] - centres[i] || 1)
      width = lerp(widths[i], widths[i + 1], t)
      break
    }
  }
  return { left: at - width / 2, right: at + width / 2 }
}

/** The link whose middle is nearest to `x`. */
export function nearestLink(spans: Span[], x: number): number {
  let best = 0
  for (let i = 1; i < spans.length; i++) {
    if (Math.abs(centre(spans[i]) - x) < Math.abs(centre(spans[best]) - x)) {
      best = i
    }
  }
  return best
}

/**
 * Moves the lens under the site links: placed, slid on springs to a link,
 * dragged under a finger, swollen while held. The magnifier is a copy of
 * the links' words inside the lens; the lens's swell enlarges it about the
 * lens's middle, so the words under a held lens show bigger.
 */
export class LensMotion {
  /** Where it is; null until it has stood under a link. */
  edges: Edges | null = null
  /** A drag owns the lens: page changes leave it alone until let go. */
  held = false
  private rest = 0
  private swell = 1
  private stops: Array<() => void> = []
  private stopSwell: (() => void) | null = null
  private readonly lens: HTMLElement
  private readonly magnifier: HTMLElement | null

  constructor(lens: HTMLElement, magnifier: HTMLElement | null) {
    this.lens = lens
    this.magnifier = magnifier
  }

  /** Whether a slide is still running. */
  get moving() {
    return this.stops.length > 0
  }

  /** Straight under `to`, without moving there. */
  place(to: Span) {
    this.halt()
    this.lens.style.opacity = '1'
    this.edges = { ...to, vLeft: 0, vRight: 0 }
    this.rest = to.right - to.left
    this.draw()
  }

  /**
   * Springs from `from` (where it is, by default) to `to`, keeping the speed
   * it had.
   */
  slide(to: Span, from: Edges | null = this.edges) {
    if (!from) return this.place(to)
    this.run(
      from,
      to,
      Math.max(from.right - from.left, to.right - to.left),
      LEAD,
      TRAIL
    )
  }

  /** Under a finger: towards `to` on stiffer springs, `to` being only its place for now. */
  follow(to: Span) {
    if (!this.edges) return this.place(to)
    this.run(this.edges, to, to.right - to.left, FOLLOW_LEAD, FOLLOW_TRAIL)
  }

  private run(
    from: Edges,
    to: Span,
    rest: number,
    lead: Spring,
    trail: Spring
  ) {
    this.halt()
    this.lens.style.opacity = '1'
    // the lens's live position, so a quick second move starts from it
    const now = { ...from }
    this.edges = now
    this.rest = rest
    // drawn now: the springs' first step is a frame away
    this.draw()
    const rightward = centre(to) > centre(from)
    const [leftSpring, rightSpring] = rightward ? [trail, lead] : [lead, trail]
    let moving = 2
    const land = () => {
      moving -= 1
      if (moving === 0) this.stops = []
    }
    this.stops = [
      springTo(
        from.left,
        to.left,
        leftSpring,
        (x, v) => {
          now.left = x
          now.vLeft = v
          this.draw()
          if (x === to.left) land()
        },
        from.vLeft
      ),
      springTo(
        from.right,
        to.right,
        rightSpring,
        (x, v) => {
          now.right = x
          now.vRight = v
          this.draw()
          if (x === to.right) land()
        },
        from.vRight
      ),
    ]
  }

  /** Nothing lit: out of sight, and the next lit link gets it in place, not slid in. */
  forget() {
    this.halt()
    this.lens.style.opacity = '0'
    this.edges = null
  }

  /** Swells (held) or settles back; `still` (reduced motion) without moving. */
  swellTo(held: boolean, still: boolean) {
    this.stopSwell?.()
    this.stopSwell = null
    const target = held && !still ? SWOLLEN : 1
    if (still) {
      this.swell = target
      this.draw()
      return
    }
    this.stopSwell = springTo(this.swell, target, SWELL, (s) => {
      this.swell = s
      this.draw()
      if (s === target) this.stopSwell = null
    })
  }

  /** Stops the slide where it is. */
  halt() {
    for (const stop of this.stops) stop()
    this.stops = []
  }

  dispose() {
    this.halt()
    this.stopSwell?.()
    this.stopSwell = null
  }

  private draw() {
    const edges = this.edges
    if (!edges) return
    const width = Math.max(0, edges.right - edges.left)
    const stretch = this.rest > 0 ? Math.max(0, width / this.rest - 1) : 0
    const squash = Math.min(MAX_SQUASH, stretch * SQUASH)
    const s = this.swell
    this.lens.style.transform = `translate3d(${edges.left}px,0,0) scale(${s},${s * (1 - squash)})`
    this.lens.style.width = `${width}px`
    // lifted: over the words, which then show through it magnified
    if (s > 1.01) this.lens.dataset.swollen = ''
    else delete this.lens.dataset.swollen
    if (this.magnifier) {
      this.magnifier.style.transform = `translate3d(${-edges.left}px,0,0)`
      this.magnifier.style.opacity = String(clamp01((s - 1) / (SWOLLEN - 1)))
    }
  }
}
