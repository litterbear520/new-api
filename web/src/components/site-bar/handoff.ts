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
/**
 * How far the bar had come together on the page being left, for the next
 * page to start from when the browser loads a whole new page (the docs are
 * another site on this domain; their bar keeps the same note). Without it
 * a page left with the pill in the middle would cross-fade into a split bar.
 */
export const HANDOFF_KEY = 'newapi:site-bar:v1:handoff'

/** This page as the next page's referrer names it: without its #part. */
function here() {
  return window.location.href.split('#')[0]
}

export function leaveHandoff(q: number) {
  try {
    sessionStorage.setItem(
      HANDOFF_KEY,
      // `at`: the docs take a prerendered page's note by its age instead
      JSON.stringify({ q, from: here(), at: Date.now() })
    )
  } catch {
    // storage blocked: the next page starts split
  }
}

/** What the page this one was opened from left (not a reload: 0). */
export function takeHandoff(): number {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY)
    sessionStorage.removeItem(HANDOFF_KEY)
    const note = JSON.parse(raw ?? 'null') as { q?: unknown; from?: unknown }
    const fromHere = !!document.referrer && note?.from === document.referrer
    return fromHere && typeof note.q === 'number' ? note.q : 0
  } catch {
    return 0
  }
}

/**
 * Where the lens under the site links stood on the page being left, and how
 * fast its edges were moving: a click on a link to another site (the docs)
 * starts the slide at once, and the next page carries it on from there.
 */
export const LENS_HANDOFF_KEY = 'newapi:site-bar:v1:lens'

/** Edges in px from the links' left; speeds in px/s. */
export type LensNote = {
  left: number
  right: number
  vLeft: number
  vRight: number
}

/** Older than this, the note is from another visit. */
export const LENS_NOTE_MS = 3000

export function leaveLens(lens: LensNote) {
  try {
    sessionStorage.setItem(
      LENS_HANDOFF_KEY,
      JSON.stringify({ ...lens, from: here(), at: Date.now() })
    )
  } catch {
    // storage blocked: the next page puts the lens in place
  }
}

/** The note left by the page `referrer` names, if it is fresh. */
export function readLensNote(
  raw: string | null,
  referrer: string,
  now: number
): LensNote | null {
  if (!raw || !referrer) return null
  try {
    const note = JSON.parse(raw) as Record<string, unknown>
    const numbers = [note.left, note.right, note.vLeft, note.vRight, note.at]
    if (!numbers.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      return null
    }
    if (note.from !== referrer) return null
    const age = now - (note.at as number)
    if (age < 0 || age > LENS_NOTE_MS) return null
    return {
      left: note.left as number,
      right: note.right as number,
      vLeft: note.vLeft as number,
      vRight: note.vRight as number,
    }
  } catch {
    return null
  }
}

export function takeLens(): LensNote | null {
  try {
    const raw = sessionStorage.getItem(LENS_HANDOFF_KEY)
    sessionStorage.removeItem(LENS_HANDOFF_KEY)
    return readLensNote(raw, document.referrer, Date.now())
  } catch {
    return null
  }
}
