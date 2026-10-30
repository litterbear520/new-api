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
 * 夜海, the chat page's hidden theme. In dark mode a meteor crosses the chat
 * page now and then; clicking it opens the night sea, and from then on the
 * theme menu of this browser lists 「夜海」. While it is on, the console is
 * dark and the chat page shows the sky; picking another theme turns it off.
 * It lives apart from the chat store so the header does not load the chat.
 */

const KEY = 'bear-chat.night-sea'

type Saved = 'found' | 'on' | null

function read(): Saved {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'found' || value === 'on' ? value : null
  } catch {
    return null
  }
}

function write(value: Saved) {
  try {
    if (value) localStorage.setItem(KEY, value)
    else localStorage.removeItem(KEY)
  } catch {
    // Private mode: the night sea lasts for this visit.
  }
}

type NightSeaState = {
  /** A meteor was caught in this browser, so the theme menu lists it. */
  found: boolean
  on: boolean
  setOn: (on: boolean) => void
}

const saved = read()

export const useNightSeaStore = create<NightSeaState>()((set, get) => ({
  found: saved !== null,
  on: saved === 'on',
  setOn: (on) => {
    if (!on && !get().found) return
    write(on ? 'on' : 'found')
    set({ found: true, on })
  },
}))
