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
import { useSyncExternalStore } from 'react'

import type { BearMood } from '@/features/bear-chat/types'

import { STORAGE_KEYS } from '../../constants'

/*
 * Lively or quiet (it only blinks), picked from the bear's right-click menu
 * and remembered in this browser. No "hidden" here: the bear itself is the
 * only way back.
 */

const listeners = new Set<() => void>()
let mood: BearMood | null = null

function read(): BearMood {
  try {
    return localStorage.getItem(STORAGE_KEYS.mood) === 'quiet'
      ? 'quiet'
      : 'live'
  } catch {
    return 'live'
  }
}

export function getBearMood(): BearMood {
  mood ??= read()
  return mood
}

export function setBearMood(next: BearMood) {
  mood = next === 'quiet' ? 'quiet' : 'live'
  try {
    localStorage.setItem(STORAGE_KEYS.mood, mood)
  } catch {
    // Private mode: lasts for this visit.
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useBearMood(): BearMood {
  return useSyncExternalStore(subscribe, getBearMood, () => 'live')
}
