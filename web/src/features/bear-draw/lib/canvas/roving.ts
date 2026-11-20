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
/*
 * A row of buttons with one Tab stop (the toolbar pattern): arrows move
 * between them, Home and End go to the ends. Browsers with focusgroup do
 * it natively; elsewhere the buttons get a roving tabindex.
 */

const ITEMS = 'button:not([disabled])'

export const hasFocusgroup = (): boolean =>
  'focusGroup' in HTMLElement.prototype

function items(bar: HTMLElement): HTMLButtonElement[] {
  return [...bar.querySelectorAll<HTMLButtonElement>(ITEMS)]
}

/** Makes `to` (or the first button) the one Tab reaches. */
export function setTabStop(bar: HTMLElement, to?: Element | null) {
  if (hasFocusgroup()) return
  const list = items(bar)
  const stop = list.find((b) => b === to) ?? list[0]
  for (const b of list) b.tabIndex = b === stop ? 0 : -1
}

export function rovingToolbar(bar: HTMLElement) {
  bar.setAttribute('focusgroup', 'toolbar wrap')
  if (hasFocusgroup()) return
  bar.addEventListener('focusin', (e) => {
    if (e.target instanceof HTMLButtonElement) setTabStop(bar, e.target)
  })
  bar.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const list = items(bar)
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    const rtl = getComputedStyle(bar).direction === 'rtl'
    let next = -1
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = list.length - 1
    else if (e.key === 'ArrowRight') next = at + (rtl ? -1 : 1)
    else if (e.key === 'ArrowLeft') next = at + (rtl ? 1 : -1)
    else return
    e.preventDefault()
    list[(next + list.length) % list.length]?.focus({ preventScroll: true })
  })
}
