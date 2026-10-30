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
import type { Rect } from './types'

/* Small DOM helpers shared by the canvas modules (and the halftone). */

export const SVG_NS = 'http://www.w3.org/2000/svg'

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Text made safe for innerHTML (text and attribute values). */
export const esc = (s: string | number | null | undefined): string =>
  String(s ?? '').replaceAll(/[&<>"']/g, (ch) => ESC[ch] ?? ch)

export const elOf = (t: EventTarget | null): Element | null =>
  t instanceof Element ? t : null

export function closest(
  t: EventTarget | null,
  selector: string
): HTMLElement | null {
  return elOf(t)?.closest<HTMLElement>(selector) ?? null
}

/** A text field has the keyboard: canvas shortcuts stay quiet. */
export const isTyping = (t: EventTarget | null): boolean =>
  closest(
    t,
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
  ) != null

export const reduced = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const now = (): number => performance.now()

/** Reports an error from a page callback without breaking the canvas. */
export function report(err: unknown) {
  if (typeof reportError === 'function') reportError(err)
}

export const translate = (x: number, y: number) =>
  `translate3d(${x}px,${y}px,0)`

/** Puts a screen-space box at r. */
export function place(e: HTMLElement, r: Rect) {
  e.style.transform = translate(r.x, r.y)
  e.style.width = `${r.w}px`
  e.style.height = `${r.h}px`
}

/** Reused overlay boxes (selection outlines, badges, drop ghosts). */
export type Pool = {
  begin: () => void
  next: () => HTMLDivElement
  end: () => void
}

export function mkPool(parent: HTMLElement, cls: string): Pool {
  const items: HTMLDivElement[] = []
  let used = 0
  return {
    begin() {
      used = 0
    },
    next() {
      let e = items[used]
      if (!e) {
        e = h('div', cls)
        parent.append(e)
        items.push(e)
      }
      if (e.style.display) e.style.display = ''
      used++
      return e
    },
    end() {
      for (let i = used; i < items.length; i++) {
        if (items[i].style.display !== 'none') items[i].style.display = 'none'
      }
    },
  }
}
