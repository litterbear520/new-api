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
import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * What the chat and draw pages do around their meteors (components/meteor.tsx):
 * the bear's notice and tip, and the night sky spreading from the wish.
 */

/** How long the bear's tip about the meteors stays */
const HINT_MS = 6000
/** How long the sky takes to spread after a wish */
export const DAWN_MS = 1600

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Meteors in the sky and the bear's tip about them: `notice` while they come,
 * `hinted` for a few seconds after the bear was clicked about them.
 */
export function useSighting(onStart?: () => void) {
  const [sighting, setSighting] = useState(false)
  const [hinted, setHinted] = useState(false)
  const was = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const start = useRef(onStart)
  start.current = onStart
  const onSighting = useCallback((flying: boolean) => {
    if (flying === was.current) return
    was.current = flying
    setSighting(flying)
    if (flying) start.current?.()
    else setHinted(false)
  }, [])
  const onNotice = useCallback(() => {
    setHinted(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setHinted(false), HINT_MS)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { sighting, hinted, onSighting, onNotice }
}

/** The night sky spreads over `area` as a circle from the wish (page coordinates). */
export function spreadSky(
  sky: HTMLElement,
  area: HTMLElement,
  at: { x: number; y: number } | null
) {
  if (typeof sky.animate !== 'function') return
  if (reducedMotion()) {
    sky.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 })
    return
  }
  const box = area.getBoundingClientRect()
  const cx = (at?.x ?? box.left + box.width / 2) - box.left
  const cy = (at?.y ?? box.top) - box.top
  const r = Math.hypot(
    Math.max(cx, box.width - cx),
    Math.max(cy, box.height - cy)
  )
  sky.animate(
    [
      { clipPath: `circle(0px at ${cx}px ${cy}px)` },
      { clipPath: `circle(${r}px at ${cx}px ${cy}px)` },
    ],
    { duration: DAWN_MS - 100, easing: 'cubic-bezier(.45,.05,.25,1)' }
  )
}
