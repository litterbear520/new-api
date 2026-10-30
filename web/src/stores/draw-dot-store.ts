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
import { create } from 'zustand'

/*
 * The red dot on the sidebar's 画图 item. It shows until the draw page is
 * opened once in this browser, and again when a picture finishes while the
 * user is on another page; opening the page clears it. It lives apart from
 * the draw store so the sidebar does not load the drawing code.
 */

const SEEN_KEY = 'draw.seen'
const DONE_KEY = 'draw.done'

/** `new`: the page was never opened here; `done`: a picture finished elsewhere. */
export type DrawDot = 'new' | 'done' | null

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // Private mode: the dot state lasts for this visit.
  }
}

function initialDot(): DrawDot {
  if (readFlag(DONE_KEY)) return 'done'
  if (readFlag(SEEN_KEY)) return null
  return 'new'
}

type DrawDotState = {
  dot: DrawDot
  /** The draw page is on screen in this tab. */
  open: boolean
  pageOpened: () => void
  pageClosed: () => void
  /** A picture finished or failed: lights the dot unless the page is open. */
  finished: () => void
}

export const useDrawDotStore = create<DrawDotState>()((set, get) => ({
  dot: initialDot(),
  open: false,
  pageOpened: () => {
    writeFlag(SEEN_KEY, true)
    writeFlag(DONE_KEY, false)
    set({ open: true, dot: null })
  },
  pageClosed: () => set({ open: false }),
  finished: () => {
    if (get().open) return
    writeFlag(DONE_KEY, true)
    set({ dot: 'done' })
  },
}))
