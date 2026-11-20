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
import { useEffect, useRef } from 'react'

import '@/styles/scroll-fade.css'

/** The width of the fade in styles/scroll-fade.css (1.5rem) */
const FADE_PX = 24

function supportsScrollTimeline(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('animation-timeline', 'scroll()')
  )
}

/** Scrolls the row, and only the row, until `item` is in view. */
function bringIntoView(scroller: HTMLElement, item: Element | null) {
  if (!item) return
  const view = scroller.getBoundingClientRect()
  const box = item.getBoundingClientRect()
  let delta = 0
  if (box.left < view.left) delta = box.left - view.left - FADE_PX
  else if (box.right > view.right) delta = box.right - view.right + FADE_PX
  if (delta) scroller.scrollLeft += delta
}

/**
 * For a row that scrolls sideways with its scrollbar hidden: fades the ends
 * that have more content (give the row the class `scroll-fade`), and on the
 * first render scrolls the item matching `selected` into view. Browsers
 * without scroll-driven animations get the fades from an observer on the
 * first and last item. `items` is anything that changes when the items do.
 * The row is scrolled itself rather than with scrollIntoView, which would
 * also move the page.
 */
export function useScrollFade<T extends HTMLElement>(
  selected: string,
  items: unknown
) {
  const ref = useRef<T>(null)
  const shown = useRef<Element | null>(null)

  useEffect(() => {
    const scroller = ref.current
    if (!scroller) return
    if (shown.current !== scroller) {
      shown.current = scroller
      bringIntoView(scroller, scroller.querySelector(selected))
    }
    if (
      supportsScrollTimeline() ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return
    }
    const first = scroller.firstElementChild
    const last = scroller.lastElementChild
    if (!first || !last) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const more = entry.intersectionRatio < 1
          if (entry.target === first) {
            scroller.toggleAttribute('data-more-start', more)
          }
          if (entry.target === last) {
            scroller.toggleAttribute('data-more-end', more)
          }
        }
      },
      // Without the margin a sub-pixel width can leave an end item a hair
      // short of fully visible.
      { root: scroller, threshold: 1, rootMargin: '1px' }
    )
    observer.observe(first)
    observer.observe(last)
    return () => observer.disconnect()
  }, [selected, items])

  return ref
}
