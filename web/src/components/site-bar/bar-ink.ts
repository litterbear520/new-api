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
  chooseInk,
  GLASS,
  luminance,
  mix,
  type Ink,
  type Rgb,
} from './backdrop'
import { MARKED, PageReader } from './page-reader'

/** Reads per second while scrolling, as the gap between them. */
const READ_GAP_MS = 100
/** One more read once it has stopped. */
const REST_MS = 160
/** A new page's content settles in after it shows: read again as it does. */
const AFTER_PAGE_MS = [450, 1500]
/** Px between the points read along the bar. */
const STEP = 24
/** Px above and below the bar's middle that those points alternate. */
const ZIGZAG = 6

/** Everything on the bar that takes the colour; `data-bar-skip` keeps its own. */
const WORDS = '[data-bar-word],[data-site-link],button:not([data-bar-skip])'
const LENS = '[data-site-lens]'

type Point = { x: number; color: Rgb }

function setAttr(el: Element, name: string, value: string | null): void {
  if (el.getAttribute(name) === value) return
  if (value === null) el.removeAttribute(name)
  else el.setAttribute(name, value)
}

function nearest(points: readonly Point[], x: number): Point {
  return points.reduce((a, b) =>
    Math.abs(a.x - x) < Math.abs(b.x - x) ? a : b
  )
}

/**
 * Keeps the bar's words readable over what is under them; the glass itself stays
 * as it is, so the page shows through. Ask whenever
 * the page may have moved under the bar; it reads about ten times a second at
 * most, and once more when things come to rest.
 */
export class BarInk {
  private readonly bar: HTMLElement
  private readonly glass: HTMLElement
  private readonly reader = new PageReader()
  private readonly theme: MutationObserver
  private held = false
  private last = -Infinity
  private gap: ReturnType<typeof setTimeout> | undefined
  private rest: ReturnType<typeof setTimeout> | undefined
  private later: ReturnType<typeof setTimeout>[] = []
  private frame = 0

  constructor(parts: { bar: HTMLElement; glass: HTMLElement }) {
    this.bar = parts.bar
    this.glass = parts.glass
    this.theme = new MutationObserver(() => this.newPage())
    this.theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  }

  /** The page under the bar may have moved. */
  ask(): void {
    if (this.held || typeof document.elementsFromPoint !== 'function') return
    clearTimeout(this.rest)
    this.rest = setTimeout(() => this.readNextFrame(), REST_MS)
    if (this.gap !== undefined) return
    const wait = Math.max(0, READ_GAP_MS - (performance.now() - this.last))
    this.gap = setTimeout(() => {
      this.gap = undefined
      this.readNextFrame()
    }, wait)
  }

  /** A new page is up: forget the last one and watch this one settle in. */
  newPage(): void {
    this.ask()
    for (const id of this.later) clearTimeout(id)
    this.later = AFTER_PAGE_MS.map((ms) => setTimeout(() => this.ask(), ms))
  }

  /** Held, the bar keeps its own colours and nothing is read. */
  hold(held: boolean): void {
    if (this.held === held) return
    this.held = held
    if (!held) return this.newPage()
    this.stopTimers()
    this.clear()
  }

  dispose(): void {
    this.theme.disconnect()
    this.stopTimers()
  }

  private stopTimers(): void {
    clearTimeout(this.gap)
    clearTimeout(this.rest)
    for (const id of this.later) clearTimeout(id)
    this.gap = undefined
    this.later = []
    cancelAnimationFrame(this.frame)
    this.frame = 0
  }

  private clear(): void {
    for (const el of this.bar.querySelectorAll(`${WORDS},${LENS}`)) {
      el.removeAttribute('data-ink')
    }
  }

  private readNextFrame(): void {
    if (this.frame || this.held) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.last = performance.now()
      if (this.held) return
      this.readPage()
      if (this.reader.behind) this.ask()
    })
  }

  private readPage(): void {
    const dark = document.documentElement.classList.contains('dark')
    this.reader.startReading(this.bar, dark ? MARKED.dark : [255, 255, 255])
    const box = this.glass.getBoundingClientRect()
    const y = box.top + box.height / 2

    const row = this.readRow(box, y)
    if (!row.length) return
    const tint = dark ? GLASS.dark : GLASS.light

    const lumsUnder = (r: DOMRect): number[] => {
      const middle = r.left + r.width / 2
      if (middle < box.left || middle > box.right) {
        return this.lumsBesideGlass(r, y)
      }
      const under = row.filter((p) => p.x >= r.left && p.x <= r.right)
      const points = under.length ? under : [nearest(row, r.left)]
      return points.map((p) => luminance(mix(p.color, tint.color, tint.alpha)))
    }

    for (const word of this.bar.querySelectorAll<HTMLElement>(WORDS)) {
      const r = word.getBoundingClientRect()
      if (!r.width) continue
      const was = word.dataset.ink as Ink | undefined
      setAttr(word, 'data-ink', chooseInk(lumsUnder(r), was))
    }
    const lens = this.bar.querySelector<HTMLElement>(LENS)
    const lensBox = lens?.getBoundingClientRect()
    if (lens && lensBox?.width) {
      const was = lens.dataset.ink as Ink | undefined
      setAttr(lens, 'data-ink', chooseInk(lumsUnder(lensBox), was))
    }
  }

  /**
   * Points along the glass, in turn above and below the middle so that an edge
   * running along the bar shows too.
   */
  private readRow(box: DOMRect, y: number): Point[] {
    const row: Point[] = []
    let above = true
    for (let x = box.left + 4; x < box.right; x += STEP) {
      const color = this.reader.at(x, y + (above ? -ZIGZAG : ZIGZAG))
      above = !above
      row.push({ x, color })
    }
    return row
  }

  /** Beside the glass (the brand while the bar is split): the page itself. */
  private lumsBesideGlass(r: DOMRect, y: number): number[] {
    return [0.2, 0.5, 0.8].map((part, i) => {
      const at = y + (i === 1 ? ZIGZAG : -ZIGZAG)
      return luminance(this.reader.at(r.left + r.width * part, at))
    })
  }
}
