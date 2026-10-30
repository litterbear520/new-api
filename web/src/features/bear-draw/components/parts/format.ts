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
import type { TFunction } from 'i18next'

import type { PlanItem, ProgressItem } from '../../types'

/** A running clock: 0:07, 1:24. */
export function clock(secs: number): string {
  const s = Math.max(0, Math.floor(secs))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** How long something took: 「9 秒」, 「1 分 9 秒」. */
export function duration(secs: number, t: TFunction): string {
  const s = Math.max(0, Math.round(secs))
  if (s < 60) return t('{{count}} s', { count: s })
  return t('{{m}} min {{s}} s', { m: Math.floor(s / 60), s: s % 60 })
}

/** "800×800" → "800 / 800", for CSS aspect-ratio. */
export function sizeAspect(size: string | undefined): string | null {
  const m = /(\d+)\s*[×xX*]\s*(\d+)/.exec(size ?? '')
  if (!m) return null
  return `${m[1]} / ${m[2]}`
}

/** Rounding of a picture's whole seconds, when chaining finish to start. */
const SLACK_MS = 1500

/**
 * When the pictures drawing now started, for the set's clock: the earliest
 * start among them, reaching back through pictures of the same run that
 * finished meanwhile (a queued picture starts when another ends). A picture
 * drawn again later starts its own clock. Null while nothing draws.
 */
export function runStart(items: ProgressItem[]): number | null {
  const drawing = items.filter((x) => x.status === 'drawing' && x.startedAt)
  if (!drawing.length) return null
  let start = Math.min(...drawing.map((x) => x.startedAt ?? Infinity))
  let moved = true
  while (moved) {
    moved = false
    for (const x of items) {
      if (x.status === 'drawing' || x.startedAt == null || x.secs == null) {
        continue
      }
      const end = x.startedAt + x.secs * 1000
      if (x.startedAt < start && end >= start - SLACK_MS) {
        start = x.startedAt
        moved = true
      }
    }
  }
  return start
}

/** USD of the ticked pictures of a plan. */
export function planTotal(items: PlanItem[]): number {
  return items.reduce((sum, it) => (it.on ? sum + it.est : sum), 0)
}
