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
import type { BearDirector } from '@/features/bear-chat/lib/bear/director'

/** The entrance plays once per page load, not on every visit to a project. */
let entered = false
/** The longest entrance (peekaboo: rise, look round, hop). */
const ENTRANCE_MS = 2600

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Light: the bear rises from behind the glass, looks round and hops onto the
 * rim (the chat page's peekaboo). Night: it drops into its boat. Returns a
 * function that cuts the entrance short when the composer goes away; a cut
 * entrance plays again next time (also StrictMode's mount, unmount, mount).
 */
export function playEntrance(
  svg: SVGSVGElement,
  perch: HTMLElement | null,
  d: BearDirector,
  dark: boolean
): () => void {
  if (entered) return () => undefined
  entered = true
  const started = Date.now()
  let stop: () => void = () => undefined
  if (reducedMotion()) d.show('greet')
  else if (dark) d.show('drop')
  else if (!perch || typeof svg.animate !== 'function') d.show('greet')
  else stop = peekaboo(svg, perch, d)
  return () => {
    stop()
    if (Date.now() - started >= ENTRANCE_MS) return
    entered = false
    // the next director starts from idle, not from a half-played act
    svg.dataset.act = 'idle'
  }
}

function peekaboo(svg: SVGSVGElement, perch: HTMLElement, d: BearDirector) {
  const timers: Array<ReturnType<typeof setTimeout>> = []
  perch.classList.add('bd-behind')
  svg.animate(
    [{ transform: 'translateY(34px)' }, { transform: 'translateY(13px)' }],
    { duration: 460, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }
  )
  timers.push(setTimeout(() => d.show('peek'), 380))
  timers.push(
    setTimeout(() => {
      svg.getAnimations().forEach((a) => a.cancel())
      const hop = svg.animate(
        [
          { transform: 'translateY(13px)' },
          { transform: 'translateY(-16px) scale(.95,1.06)', offset: 0.45 },
          { transform: 'translateY(0) scale(1.12,.88)', offset: 0.78 },
          { transform: 'none' },
        ],
        { duration: 600, easing: 'ease-out' }
      )
      timers.push(setTimeout(() => perch.classList.remove('bd-behind'), 230))
      hop.addEventListener('finish', () => d.show('idle'))
    }, 1900)
  )
  return () => {
    timers.forEach(clearTimeout)
    svg.getAnimations().forEach((a) => a.cancel())
    perch.classList.remove('bd-behind')
  }
}
