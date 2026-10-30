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
import { useCallback, useEffect, useRef, type RefObject } from 'react'

import { applyGlass, glassSupported, type GlassOptions } from '../lib/glass'

/**
 * Ref callback that keeps an element's liquid-glass lens fitted to its size
 * and to the light/dark theme. Does nothing outside Chromium.
 */
export function useGlass<T extends HTMLElement>(opts: GlassOptions) {
  const optsRef = useRef(opts)
  optsRef.current = opts
  const cleanup = useRef<(() => void) | null>(null)

  return useCallback((el: T | null) => {
    cleanup.current?.()
    cleanup.current = null
    if (!el || !glassSupported) return
    const fit = () => applyGlass(el, optsRef.current)
    const ro = new ResizeObserver(fit)
    ro.observe(el, { box: 'border-box' })
    const mo = new MutationObserver(fit)
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    cleanup.current = () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [])
}

/** The hairline of light on every glass surface turns towards the mouse. */
export function useGlassLight(
  root: RefObject<HTMLElement | null>,
  selector = '.dw-glass'
) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    let point: { x: number; y: number } | null = null
    let raf = 0
    const paint = () => {
      raf = 0
      el.querySelectorAll<HTMLElement>(selector).forEach((g) => {
        if (!point) {
          g.style.setProperty('--la', '320deg')
          return
        }
        const r = g.getBoundingClientRect()
        if (!r.width) return
        const dx = point.x - (r.left + r.width / 2)
        const dy = point.y - (r.top + r.height / 2)
        g.style.setProperty(
          '--la',
          `${((Math.atan2(dx, -dy) * 180) / Math.PI).toFixed(1)}deg`
        )
      })
    }
    const soon = () => {
      raf ||= requestAnimationFrame(paint)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      point = { x: e.clientX, y: e.clientY }
      soon()
    }
    const leave = (e: MouseEvent) => {
      if (e.relatedTarget) return
      point = null
      soon()
    }
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('mouseout', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('mouseout', leave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [root, selector])
}
