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
// Under a finger it stays with the finger: time constants in seconds, small
// enough to read as direct and enough to even out uneven pointer events.
const TRACK = 0.012
/** Pressed somewhere else, it first glides over to the finger this much slower. */
const GLIDE = 0.07
const GLIDE_FADE = 0.12
const WIDTH_EASE = 0.06
const SPEED_EASE = 0.05
/** Moving, its tail draws out, in px per px/s, up to a limit. */
const STRETCH = 0.012
const MAX_STRETCH = 16
/** Most of the stretch trails the finger. */
const TAIL = 0.7

/** Held, the lens swells like a drop of water lifted off the bar. */
export const SWOLLEN = 1.2
const SWELL: Spring = { stiffness: 420, damping: 22 }

/** Stretched past the wider of its two links, the lens thins like a drop. */
const SQUASH = 0.3
const MAX_SQUASH = 0.14

/** How far past the first and last links a dragged lens can be pulled, in px. */
const MAX_PULL = 8
/** The pull's stiffness, as in iOS's rubber band. */
const RUBBER = 0.55

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Swollen past this, the lens is lifted over the words and covers them. */
const LIFTED = 1.01

/**
 * How much of the magnifier shows. It comes in as the lens swells; on the way
 * down it stays whole for as long as the lens covers the words, or they would
 * wash out under it, for as long as a page load holds the frame.
 */
export function magnifierOpacity(swell: number, lifting: boolean) {
  if (lifting) return clamp01((swell - 1) / (SWOLLEN - 1))
  return swell > LIFTED ? 1 : 0
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const centre = (span: Span) => (span.left + span.right) / 2

/**
 * The lens under a finger at `x`: centred on it and as wide as the links it
 * is between, held back like rubber past the first and last.
 */
export function lensAt(
  spans: Span[],
  x: number,
  bounds: Span | null = null,
  swell = 1
): Span {
  const centres = spans.map(centre)
  const widths = spans.map((span) => span.right - span.left)
  const first = centres[0]
  const last = centres.at(-1) ?? first
  // where its middle can be with its swollen edges still inside the bar
  const hardLow = bounds ? bounds.left + (widths[0] * swell) / 2 : -Infinity
  const hardHigh = bounds
    ? bounds.right - ((widths.at(-1) ?? 0) * swell) / 2
    : Infinity
  const low = Math.max(first, hardLow)
  const high = Math.max(low, Math.min(last, hardHigh))
  // Past the ends the pull first moves it, while there is room, then squeezes
  // it against the end of the bar.
  let at = x
  let squeeze = 0
  if (at < low) {
    const pull = pulled(low - at, MAX_PULL)
    const give = Math.min(pull, low - hardLow)
    squeeze = pull - give
    at = low - give - (squeeze * swell) / 2
  } else if (at > high) {
    const pull = pulled(at - high, MAX_PULL)
    const give = Math.min(pull, hardHigh - high)
    squeeze = pull - give
    at = high + give + (squeeze * swell) / 2
  }
  let width = (at <= first ? widths[0] : widths.at(-1)) ?? 0
  for (let i = 0; i < centres.length - 1; i++) {
    if (at >= centres[i] && at <= centres[i + 1]) {
      const t = (at - centres[i]) / (centres[i + 1] - centres[i] || 1)
      width = lerp(widths[i], widths[i + 1], t)
      break
    }
  }
  width = Math.max(0, width - squeeze)
  const span = { left: at - width / 2, right: at + width / 2 }
  return bounds ? keepInside(span, bounds, swell) : span
}

/** How far a pull of `past` px moves something that gives `limit` px at most. */
function pulled(past: number, limit: number) {
  if (limit <= 0) return 0
  return limit * (1 - 1 / ((past * RUBBER) / limit + 1))
}

/** The span moved and narrowed as little as it takes to stay in `bounds` once scaled by `scale`. */
export function keepInside(span: Span, bounds: Span, scale: number): Span {
  const half = Math.min(
    (span.right - span.left) / 2,
    Math.max(0, bounds.right - bounds.left) / (2 * scale)
  )
  const middle = Math.min(
    bounds.right - half * scale,
    Math.max(bounds.left + half * scale, centre(span))
  )
  return { left: middle - half, right: middle + half }
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

/** The lens under a finger: where it is, where the finger wants it, one frame loop. */
type Chase = {
  to: Span
  middle: number
  width: number
  speed: number
  /** 1 pressed away from the lens, fading to 0 as it reaches the finger. */
  glide: number
  last: number
  frame: number
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
  /** What it must stay inside while held and until it lands, in px from the links' left. */
  private bounds: Span | null = null
  private chase: Chase | null = null
  private rest = 0
  private swell = 1
  private lifting = false
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
    return this.stops.length > 0 || this.chase !== null
  }

  /** Straight under `to`, without moving there. */
  place(to: Span) {
    this.halt()
    if (!this.held) this.bounds = null
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

  /**
   * Taken by a drag: it stays inside `bounds` from now until it lands, and
   * `away` (pressed away from it) has it glide over to the finger first.
   */
  hold(bounds: Span, away: boolean) {
    this.held = true
    this.bounds = bounds
    this.halt()
    const edges = this.edges
    if (!edges) return
    const middle = centre(edges)
    this.chase = {
      to: { left: edges.left, right: edges.right },
      middle,
      width: edges.right - edges.left,
      speed: 0,
      glide: away ? 1 : 0,
      last: performance.now(),
      frame: 0,
    }
  }

  /** The bar moved under the finger, or the room in it changed. */
  setBounds(bounds: Span) {
    this.bounds = bounds
  }

  /**
   * Under a finger: `to` is where it should be now. Called for every pointer
   * event, it only sets the target; one frame loop moves the lens. (Restarting
   * a spring for each event would leave it no time to move: an event and the
   * next frame come almost together.)
   */
  follow(to: Span): void {
    if (!this.edges) return this.place(to)
    const chase = this.chase
    if (!chase) {
      this.hold(this.bounds ?? { left: -Infinity, right: Infinity }, false)
      return this.follow(to)
    }
    chase.to = to
    this.lens.style.opacity = '1'
    if (!chase.frame) {
      chase.last = performance.now()
      this.chaseOn(chase)
    }
  }

  private chaseOn(chase: Chase) {
    chase.frame = requestAnimationFrame(() => {
      const now = performance.now()
      // at least a sliver of time: an event and its frame can share a moment
      const dt = Math.max(1 / 240, Math.min((now - chase.last) / 1000, 0.05))
      chase.last = now
      const toward = (time: number) => 1 - Math.exp(-dt / time)
      const target = centre(chase.to)
      const before = chase.middle
      chase.glide *= Math.exp(-dt / GLIDE_FADE)
      chase.middle +=
        (target - chase.middle) * toward(TRACK + chase.glide * GLIDE)
      chase.width +=
        (chase.to.right - chase.to.left - chase.width) * toward(WIDTH_EASE)
      chase.speed +=
        ((chase.middle - before) / dt - chase.speed) * toward(SPEED_EASE)
      const stretch = Math.min(MAX_STRETCH, Math.abs(chase.speed) * STRETCH)
      const tail = stretch * TAIL
      const nose = stretch - tail
      const half = chase.width / 2
      this.edges = {
        left: chase.middle - half - (chase.speed > 0 ? tail : nose),
        right: chase.middle + half + (chase.speed > 0 ? nose : tail),
        vLeft: chase.speed,
        vRight: chase.speed,
      }
      this.rest = chase.width
      this.draw()
      const still =
        Math.abs(target - chase.middle) < 0.02 && Math.abs(chase.speed) < 1
      if (
        still &&
        Math.abs(chase.to.right - chase.to.left - chase.width) < 0.02
      ) {
        // nothing to do until the finger moves again
        chase.frame = 0
      } else {
        this.chaseOn(chase)
      }
    })
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
      if (moving > 0) return
      this.stops = []
      this.bounds = null
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
    this.bounds = null
    this.lens.style.opacity = '0'
    this.edges = null
  }

  /** Swells (held) or settles back; `still` (reduced motion) without moving. */
  swellTo(held: boolean, still: boolean) {
    this.stopSwell?.()
    this.stopSwell = null
    const target = held && !still ? SWOLLEN : 1
    this.lifting = target > 1
    if (still) {
      this.swell = target
      this.draw()
      return
    }
    this.stopSwell = springTo(this.swell, target, SWELL, (s) => {
      this.swell = s
      // a chase draws every frame by itself
      if (!this.chase?.frame) this.draw()
      if (s === target) this.stopSwell = null
    })
  }

  /** Stops the slide where it is. */
  halt() {
    for (const stop of this.stops) stop()
    this.stops = []
    if (this.chase) cancelAnimationFrame(this.chase.frame)
    this.chase = null
  }

  dispose() {
    this.halt()
    this.stopSwell?.()
    this.stopSwell = null
  }

  private draw() {
    const edges = this.edges
    if (!edges) return
    const s = this.swell
    const { left, right } = this.bounds
      ? keepInside(edges, this.bounds, s)
      : edges
    const width = Math.max(0, right - left)
    const stretch = this.rest > 0 ? Math.max(0, width / this.rest - 1) : 0
    const squash = Math.min(MAX_SQUASH, stretch * SQUASH)
    this.lens.style.transform = `translate3d(${left}px,0,0) scale(${s},${s * (1 - squash)})`
    this.lens.style.width = `${width}px`
    // lifted: over the words, which then show through it magnified
    if (s > LIFTED) this.lens.dataset.swollen = ''
    else delete this.lens.dataset.swollen
    if (this.magnifier) {
      this.magnifier.style.transform = `translate3d(${-left}px,0,0)`
      this.magnifier.style.opacity = String(magnifierOpacity(s, this.lifting))
    }
  }
}
