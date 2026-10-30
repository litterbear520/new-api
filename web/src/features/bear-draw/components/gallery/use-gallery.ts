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
import { useCallback, useEffect, useState } from 'react'

import type * as GalleryModule from '../../data/gallery'

/*
 * The 玩法 data is its own chunk, loaded after the hero has painted.
 * One load per visit, shared by the wall and the home page's draft.
 */

export type GalleryData = typeof GalleryModule

let cache: GalleryData | null = null
let pending: Promise<GalleryData> | null = null

export function loadGallery(): Promise<GalleryData> {
  if (cache) return Promise.resolve(cache)
  if (!pending) {
    pending = import('../../data/gallery')
      .then((m) => {
        cache = m
        return m
      })
      .catch((e: unknown) => {
        pending = null
        throw e
      })
  }
  return pending
}

export type GalleryState =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }
  | { status: 'ready'; data: GalleryData }

export function useGallery(): GalleryState {
  const [data, setData] = useState<GalleryData | null>(cache)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (data) return
    let alive = true
    loadGallery()
      .then((m) => {
        if (alive) setData(m)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [data, attempt])

  const retry = useCallback(() => {
    setFailed(false)
    setAttempt((n) => n + 1)
  }, [])

  if (data) return { status: 'ready', data }
  return failed ? { status: 'failed', retry } : { status: 'loading' }
}
