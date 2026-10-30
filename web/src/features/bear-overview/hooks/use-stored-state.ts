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
import { useCallback, useState } from 'react'

/**
 * A small view preference kept in localStorage (chosen line, format, chart
 * range). Values outside `allowed` fall back to the default; storage errors
 * (private mode, blocked site data) only lose the preference.
 */
export function useStoredState<T extends string>(
  key: string,
  fallback: T,
  allowed?: readonly T[]
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key) as T | null
      if (saved && (!allowed || allowed.includes(saved))) return saved
    } catch {
      // Storage unavailable: use the default.
    }
    return fallback
  })
  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, next)
      } catch {
        // Storage unavailable: the choice lasts until the page closes.
      }
    },
    [key]
  )
  return [value, update]
}
