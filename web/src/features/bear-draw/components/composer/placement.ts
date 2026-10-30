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

/** Tallest the "/" "@" list gets. */
const PICK_MAX = 340
/** Room above the box that is enough to open there. */
const ENOUGH_ABOVE = 280
const GAP = 16

export type PickPlacement = { side: 'top' | 'bottom'; max: number }

/**
 * Where the picker opens: above the composer when there is room (the dock
 * at the bottom of a project), below it otherwise (the home composer sits
 * high on its page). Room is measured inside the nearest ancestor that
 * clips, so the list never hides under a scroll area's edge.
 */
export function pickerPlacement(composer: HTMLElement): PickPlacement {
  const r = composer.getBoundingClientRect()
  let top = 0
  let bottom = window.innerHeight
  for (let p = composer.parentElement; p; p = p.parentElement) {
    if (/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowY)) {
      const box = p.getBoundingClientRect()
      top = Math.max(top, box.top)
      bottom = Math.min(bottom, box.bottom)
      break
    }
  }
  const above = r.top - top - GAP
  const below = bottom - r.bottom - GAP
  const side = above >= ENOUGH_ABOVE || above >= below ? 'top' : 'bottom'
  const room = side === 'top' ? above : below
  return { side, max: Math.max(160, Math.min(PICK_MAX, room)) }
}
