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
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useTranslation } from 'react-i18next'

import { METEOR_AT } from '../lib/bear/director'

import './meteor.css'

/*
 * The way into the night sea, on the chat and draw pages: in plain dark,
 * meteors cross the top of the page one after another, from right after the
 * bear's entrance; the bear notices them (an exclamation mark, eyes on them)
 * and, when clicked, tells the user to wish on one. Clicking a meteor makes a
 * wish and the sky spreads from that point. With nobody around for as long
 * as the bear takes to fall asleep, the stream rests, so an idle page stops
 * drawing; the next pointer, key or wheel brings it back.
 */

/** The first comes right after the bear's entrance */
const SOON = 3000
/** The pause before the next one */
const GAP = [1200, 2400] as const
const FLIGHT = 2600
/** Pointer over the meteor: it slows down so it can be caught. */
const HOVER_RATE = 0.3
const WISH_AFTER = 450
/** Nobody around this long: no more meteors (the bear's SLEEP_AFTER). */
const REST_AFTER = 80_000
const SPARKS = 8

/** What counts as somebody being around. */
const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const

/** Fired on window to send a meteor now (the preview's button). */
export const SUMMON_METEOR = 'bear-chat:meteor'

const between = ([a, b]: readonly [number, number]) =>
  a + Math.random() * (b - a)

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

type Flight = {
  id: number
  /** Start, in px from the top left of the chat area */
  x: number
  y: number
  /** Travel, in px */
  dx: number
  dy: number
  still: boolean
}

/** A path across the upper part, ending above `floor` (px from the top). */
function plan(host: HTMLElement, id: number, floor: number | null): Flight {
  const w = host.clientWidth
  const h = host.clientHeight
  const len = Math.min(w * 0.38, 520)
  let y = Math.max(72, h * (0.08 + Math.random() * 0.12))
  let ang = ((18 + Math.random() * 14) * Math.PI) / 180
  if (floor != null) {
    // higher and flatter, so it stays above what is below (the draw
    // page's composer)
    y = Math.max(40, Math.min(y, floor - 60))
    const room = Math.max(0, floor - y)
    ang = Math.min(ang, Math.asin(Math.min(1, room / Math.max(1, len))))
  }
  return {
    id,
    x: w * (0.55 + Math.random() * 0.3),
    y,
    dx: -Math.cos(ang) * len,
    dy: Math.sin(ang) * len,
    still: reducedMotion(),
  }
}

export function Meteors(props: {
  /** False under the night sea: no new meteors, a wish still plays out. */
  active: boolean
  /** Meteors are coming (the whole stream is one sighting), or not. */
  onSighting: (flying: boolean) => void
  /** Where it was caught, in page coordinates. */
  onWish: (x: number, y: number) => void
  /** How far down a meteor may go, in px from the top, or null for no limit */
  floor?: () => number | null
}) {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [wish, setWish] = useState<{ id: number; x: number; y: number }>()
  const onWish = useRef(props.onWish)
  onWish.current = props.onWish
  const onSighting = useRef(props.onSighting)
  onSighting.current = props.onSighting
  const floor = useRef(props.floor)
  floor.current = props.floor
  /** Plans the next meteor, once the last one is gone */
  const next = useRef<(() => void) | null>(null)

  const { active } = props
  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let n = 0
    let seen = performance.now()
    let resting = false
    const later = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(launch, ms)
    }
    const launch = () => {
      clearTimeout(timer)
      const host = hostRef.current
      // a hidden tab waits; the stream goes on when it is back
      if (!host || document.hidden) {
        later(1000)
        return
      }
      if (performance.now() - seen > REST_AFTER) {
        resting = true
        onSighting.current(false)
        return
      }
      setFlight(plan(host, ++n, floor.current?.() ?? null))
      onSighting.current(true)
    }
    const onActivity = () => {
      seen = performance.now()
      if (!resting) return
      resting = false
      later(between(GAP))
    }
    next.current = () => later(between(GAP))
    later(SOON)
    window.addEventListener(SUMMON_METEOR, launch)
    const opts = { passive: true }
    for (const type of ACTIVITY) window.addEventListener(type, onActivity, opts)
    return () => {
      clearTimeout(timer)
      next.current = null
      window.removeEventListener(SUMMON_METEOR, launch)
      for (const type of ACTIVITY) window.removeEventListener(type, onActivity)
      onSighting.current(false)
    }
  }, [active])

  const gone = () => {
    setFlight(null)
    next.current?.()
  }

  return (
    <div ref={hostRef} className='bc-meteors'>
      {flight && (
        <Meteor
          key={flight.id}
          flight={flight}
          label={t('Make a wish')}
          onGone={gone}
          onCaught={(x, y, pageX, pageY) => {
            setWish({ id: flight.id, x, y })
            setTimeout(() => onWish.current(pageX, pageY), WISH_AFTER)
          }}
        />
      )}
      {wish && (
        <span
          key={wish.id}
          className='bc-wish'
          style={{ left: wish.x, top: wish.y }}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) setWish(undefined)
          }}
        >
          {Array.from({ length: SPARKS }, (_, i) => (
            <i
              key={i}
              style={
                { '--a': `${(360 / SPARKS) * i + 12}deg` } as CSSProperties
              }
            />
          ))}
          <b>{t('Wish made')} ✦</b>
        </span>
      )}
    </div>
  )
}

function Meteor(props: {
  flight: Flight
  label: string
  onGone: () => void
  onCaught: (x: number, y: number, pageX: number, pageY: number) => void
}) {
  const { flight } = props
  const ref = useRef<HTMLButtonElement>(null)
  const anim = useRef<Animation | null>(null)
  const hover = useRef(false)
  const done = useRef(props.onGone)
  done.current = props.onGone

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof el.animate !== 'function') {
      done.current()
      return
    }
    const to = `translate(${flight.dx}px, ${flight.dy}px)`
    const a = flight.still
      ? el.animate(
          [
            { opacity: 0 },
            { opacity: 1, offset: 0.2 },
            { opacity: 1, offset: 0.8 },
            { opacity: 0 },
          ],
          { duration: 4000, fill: 'forwards' }
        )
      : el.animate(
          [
            { transform: 'none', opacity: 0 },
            { opacity: 1, offset: 0.15 },
            { opacity: 1, offset: 0.8 },
            { transform: to, opacity: 0 },
          ],
          { duration: FLIGHT, easing: 'linear', fill: 'forwards' }
        )
    anim.current = a
    a.addEventListener('finish', () => done.current())
    // every bear on the page watches it; the point is worked out from the
    // flight's progress, as reading the box every frame forces a layout
    const r = el.getBoundingClientRect()
    const x0 = r.left + r.width / 2
    const y0 = r.top + r.height / 2
    let raf = requestAnimationFrame(function look() {
      const p = flight.still
        ? 0
        : Math.min(1, Number(a.currentTime ?? 0) / FLIGHT)
      const at = { x: x0 + flight.dx * p, y: y0 + flight.dy * p }
      window.dispatchEvent(new CustomEvent(METEOR_AT, { detail: at }))
      raf = requestAnimationFrame(look)
    })
    return () => {
      cancelAnimationFrame(raf)
      a.cancel()
    }
    // one animation per flight; the refs keep the callbacks current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight])

  const rate = () => (hover.current ? HOVER_RATE : 1)

  return (
    <button
      ref={ref}
      type='button'
      className='bc-meteor'
      aria-label={props.label}
      style={
        {
          left: flight.x,
          top: flight.y,
          '--ang': `${Math.atan2(-flight.dy, -flight.dx)}rad`,
        } as CSSProperties
      }
      onPointerEnter={() => {
        hover.current = true
        anim.current?.updatePlaybackRate(rate())
      }}
      onPointerLeave={() => {
        hover.current = false
        anim.current?.updatePlaybackRate(rate())
      }}
      onClick={(e) => {
        const el = e.currentTarget
        anim.current?.pause()
        const host = el.offsetParent?.getBoundingClientRect()
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        props.onCaught(cx - (host?.left ?? 0), cy - (host?.top ?? 0), cx, cy)
        done.current()
      }}
    >
      <span className='bc-meteor-tail' />
      <span className='bc-meteor-head' />
    </button>
  )
}
