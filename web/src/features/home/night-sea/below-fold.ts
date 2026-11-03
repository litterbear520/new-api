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
// What lies under the first screen (its sections and their dozens of small
// files) waits until the first screen is done, or the visitor goes to scroll.
import { savesData } from '../black-hole/support'

const SCROLL_INTENT = ['scroll', 'wheel', 'touchmove', 'keydown'] as const

/** A page that opens part way down: the browser puts the scroll back on these */
function opensPartWayDown(): boolean {
  const [navigation] = performance.getEntriesByType(
    'navigation'
  ) as PerformanceNavigationTiming[]
  return (
    window.scrollY > 0 ||
    window.location.hash !== '' ||
    navigation?.type === 'reload' ||
    navigation?.type === 'back_forward'
  )
}

/**
 * Calls fn, once, when the rest of the page is wanted: at the first sign of
 * scrolling, or when the browser has nothing better to do once the page has
 * loaded (not for a visitor saving data). Returns a function that calls it off.
 */
export function whenBelowFoldWanted(fn: () => void): () => void {
  if (opensPartWayDown()) {
    fn()
    return () => undefined
  }
  let done = false
  let idle = 0
  let timer = 0
  const cancel = () => {
    done = true
    for (const type of SCROLL_INTENT) window.removeEventListener(type, bringIn)
    window.removeEventListener('load', whenIdle)
    window.clearTimeout(timer)
    if (idle) window.cancelIdleCallback?.(idle)
  }
  function bringIn() {
    if (done) return
    cancel()
    fn()
  }
  function whenIdle() {
    if (window.requestIdleCallback) {
      idle = window.requestIdleCallback(bringIn, { timeout: 2000 })
    } else {
      timer = window.setTimeout(bringIn, 1000)
    }
  }
  for (const type of SCROLL_INTENT) {
    window.addEventListener(type, bringIn, { passive: true })
  }
  if (!savesData()) {
    if (document.readyState === 'complete') whenIdle()
    else window.addEventListener('load', whenIdle)
  }
  return cancel
}
