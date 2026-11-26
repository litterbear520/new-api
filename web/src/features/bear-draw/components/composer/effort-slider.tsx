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
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import { EFFORT_COST, EFFORTS } from '../../constants'
import type { Effort } from '../../types'

import '../../css/effort.css'

const LAST = EFFORTS.length - 1
/** A press that moves less than this is a click on the track, not a drag. */
const DRAG_PX = 4
/** Thin ticks between the stops; the last third (高 → 极高) is marked. */
const TICKS = Array.from({ length: 13 }, (_, i) => i)

const reduced = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The thumb leans to the nearest stop while it is dragged (C1-continuous). */
function magnetic(raw: number): number {
  const centre = Math.round(raw * LAST) / LAST
  const u = (raw - centre) * (LAST * 2)
  return centre + (0.55 * u + 0.45 * u * u * u) / (LAST * 2)
}

/**
 * 思考强度 (design: Gemini 4 Neon, 2026-11-26): a 32 px optical track with a
 * concentric thumb. Four stops; the fill slides and its four colours
 * cross-fade, so every motion is a transform or an opacity, and nothing
 * moves while the slider rests. A click on the track glides to the nearest
 * stop; a drag follows the pointer (the layout is read once, on the press).
 */
export function EffortSlider(props: {
  value: Effort
  onChange: (next: Effort) => void
}) {
  const { t } = useTranslation()
  const index = Math.max(
    0,
    EFFORTS.findIndex((x) => x.id === props.value)
  )
  const wrapRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const rippleRef = useRef<HTMLDivElement>(null)
  const glintRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [drag] = useState(() => ({
    active: false,
    moved: false,
    startX: 0,
    left: 0,
    width: 1,
    raf: 0,
    pending: null as number | null,
    index,
  }))
  drag.index = index

  const show = (p: number) =>
    wrapRef.current?.style.setProperty('--p', String(p))

  // at rest the thumb sits on its stop; a drag places it itself
  useLayoutEffect(() => {
    if (!drag.moved) show(index / LAST)
  }, [index, drag])

  // one ripple on every new stop, one glint on reaching 极高; then nothing
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (reduced()) return
    const ripple = rippleRef.current
    if (typeof ripple?.animate === 'function') {
      ripple.animate(
        [
          { opacity: 0.45, transform: 'scale(0.75)' },
          { opacity: 0, transform: 'scale(1.75)' },
        ],
        { duration: 340, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      )
    }
    const glint = glintRef.current
    if (index === LAST && typeof glint?.animate === 'function') {
      glint.animate(
        [
          { opacity: 0, transform: 'translate3d(-120%, 0, 0)' },
          { opacity: 0.85, offset: 0.22 },
          { opacity: 0.4, offset: 0.8 },
          { opacity: 0, transform: 'translate3d(260%, 0, 0)' },
        ],
        { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      )
    }
  }, [index])

  useEffect(() => () => cancelAnimationFrame(drag.raf), [drag])

  const go = (i: number) => {
    const next = Math.min(LAST, Math.max(0, i))
    if (next !== drag.index) props.onChange(EFFORTS[next].id)
  }

  const frame = () => {
    drag.raf = 0
    const raw = drag.pending
    if (raw == null) return
    drag.pending = null
    show(reduced() ? Math.round(raw * LAST) / LAST : magnetic(raw))
    go(Math.round(raw * LAST))
  }

  const at = (e: PointerEvent) =>
    Math.min(1, Math.max(0, (e.clientX - drag.left) / drag.width))

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const rail = railRef.current
    if (!rail) return
    e.preventDefault()
    e.currentTarget.focus({ preventScroll: true })
    // the only layout read of the whole gesture
    const rect = rail.getBoundingClientRect()
    drag.left = rect.left
    drag.width = Math.max(1, rect.width)
    drag.active = true
    drag.moved = false
    drag.startX = e.clientX
    drag.pending = null
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.active) return
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.startX) < DRAG_PX) return
      drag.moved = true
      setDragging(true)
    }
    drag.pending = at(e)
    drag.raf ||= requestAnimationFrame(frame)
  }

  const end = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!drag.active) return
    drag.active = false
    cancelAnimationFrame(drag.raf)
    drag.raf = 0
    drag.moved = false
    setDragging(false)
    if (cancelled) {
      show(drag.index / LAST)
      return
    }
    // where the pointer is now: a frame still queued holds an older place
    const target = Math.round(at(e) * LAST)
    drag.pending = null
    // glide (the transition is back on) to the stop
    show(target / LAST)
    go(target)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next = index
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = index + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = index - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = LAST
    else return
    e.preventDefault()
    go(next)
  }

  const level = EFFORTS[index]
  const cost = t(EFFORT_COST[level.id])
  return (
    <div className='bd-es' data-level={level.id}>
      <div className='bd-es-head'>
        <span>{t('Thinking effort')}</span>
        <span className='bd-es-badge'>{cost}</span>
      </div>
      <div
        ref={wrapRef}
        className='bd-es-wrap'
        role='slider'
        tabIndex={0}
        aria-label={t('Thinking effort')}
        aria-valuemin={0}
        aria-valuemax={LAST}
        aria-valuenow={index}
        aria-valuetext={`${t(level.label)}, ${cost}`}
        data-dragging={dragging ? '' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => end(e, false)}
        onPointerCancel={(e) => end(e, true)}
        onKeyDown={onKeyDown}
      >
        <div className='bd-es-track'>
          <div ref={railRef} className='bd-es-rail'>
            <div className='bd-es-ticks' aria-hidden='true'>
              {TICKS.map((i) => (
                <i
                  key={i}
                  data-major={i % 4 === 0 ? '' : undefined}
                  data-over={i > 8 ? '' : undefined}
                />
              ))}
            </div>
            <div className='bd-es-fill'>
              <div className='bd-es-fill-body'>
                {EFFORTS.map((x) => (
                  <i key={x.id} data-of={x.id} />
                ))}
                <div ref={glintRef} className='bd-es-glint' />
              </div>
            </div>
            <div className='bd-es-pips' aria-hidden='true'>
              {EFFORTS.map((x, i) => (
                <i
                  key={x.id}
                  data-pos={i}
                  data-passed={i <= index ? '' : undefined}
                />
              ))}
            </div>
          </div>
          <div className='bd-es-rim' aria-hidden='true' />
        </div>
        <div className='bd-es-thumb-rail' aria-hidden='true'>
          <div className='bd-es-mover'>
            <div ref={rippleRef} className='bd-es-ripple' />
            <div className='bd-es-thumb'>
              <span className='bd-es-core'>
                {EFFORTS.map((x) => (
                  <i key={x.id} data-of={x.id} />
                ))}
                <i data-of='orbit' />
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className='bd-es-stops'>
        {EFFORTS.map((x, i) => (
          <button
            key={x.id}
            type='button'
            tabIndex={-1}
            data-pos={i}
            aria-pressed={i === index}
            onClick={() => go(i)}
          >
            {t(x.label)}
          </button>
        ))}
      </div>
    </div>
  )
}
