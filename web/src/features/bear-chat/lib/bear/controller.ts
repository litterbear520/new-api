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
import { ONCE, SOFT, type BearAct } from './acts'

/*
 * Plays acts on one bear <svg>. Like Claude's working mark, every act shows
 * for at least `min` ms before the next one takes over, so fast-changing
 * states don't flicker; one-shot acts finish and then return to idle (or to
 * whatever was asked for meanwhile). A yawn always ends in sleep, and a bear
 * asleep for 30 s holds completely still. A bear scrolled out of view pauses
 * (class `off`): its SVG parts animate on the main thread every frame.
 */

export type BearController = {
  readonly act: BearAct
  set: (act: BearAct, opts?: { now?: boolean }) => void
  /** A small nod while the user types; at most every 400 ms. */
  nod: () => void
  dispose: () => void
}

const STILL_AFTER = 30_000
const NOD_EVERY = 400

export function createBearController(
  el: SVGSVGElement,
  opts: { min?: number; onAct?: (act: BearAct) => void } = {}
): BearController {
  const min = opts.min ?? 2000
  let act = (el.dataset.act as BearAct | undefined) ?? 'idle'
  let since = performance.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  let stillTimer: ReturnType<typeof setTimeout> | undefined
  let nodTimer: ReturnType<typeof setTimeout> | undefined
  let want: BearAct | null = null
  let lastNod = 0
  const seen =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([e]) =>
          el.classList.toggle('off', !e.isIntersecting)
        )
      : null
  seen?.observe(el)

  const apply = (next: BearAct) => {
    clearTimeout(timer)
    timer = undefined
    if (next === act && !ONCE[next]) return
    // restart CSS animations even when the same one-shot plays again
    el.dataset.act = 'none'
    void el.getBoundingClientRect()
    el.dataset.act = next
    act = next
    since = performance.now()
    clearTimeout(stillTimer)
    el.classList.remove('still')
    if (next === 'sleep') {
      stillTimer = setTimeout(() => el.classList.add('still'), STILL_AFTER)
    }
    opts.onAct?.(next)
    const length = ONCE[next]
    if (length) {
      timer = setTimeout(() => {
        if (act !== next) return
        let back: BearAct = next === 'yawn' ? 'sleep' : 'idle'
        if (want && want !== next) back = want
        want = null
        apply(back)
      }, length)
    }
  }

  return {
    get act() {
      return act
    },
    set(next, setOpts) {
      want = next
      const left = min - (performance.now() - since)
      if (setOpts?.now || left <= 0 || SOFT.has(act)) {
        apply(next)
        return
      }
      if (ONCE[act]) return
      clearTimeout(timer)
      timer = setTimeout(() => apply(want ?? next), left)
    },
    nod() {
      const t = performance.now()
      if (t - lastNod < NOD_EVERY) return
      lastNod = t
      el.classList.remove('nod')
      void el.getBoundingClientRect()
      el.classList.add('nod')
      clearTimeout(nodTimer)
      nodTimer = setTimeout(() => el.classList.remove('nod'), 220)
    },
    dispose() {
      clearTimeout(timer)
      clearTimeout(stillTimer)
      clearTimeout(nodTimer)
      seen?.disconnect()
    },
  }
}
