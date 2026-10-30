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
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { loadImageUrl } from '@/features/draw/lib/images'

import { mountHalftone, type HalftoneHandle } from '../../lib/halftone'
import type { ProgressItem } from '../../types'

type Halftone = HalftoneHandle

/**
 * The 「点阵显影」 dot screen in a tile while its picture waits or draws,
 * and the print-like reveal when the picture arrives during this visit.
 * The dot screen lives in `hostRef`, an element React leaves empty; once
 * `shown` is true the tile renders the picture itself.
 */
export function useHalftone(item: ProgressItem, index: number) {
  const hostRef = useRef<HTMLSpanElement | null>(null)
  // a plain holder, so effect cleanups can reach the live dot screen
  const [box] = useState<{ ht: Halftone | null }>(() => ({ ht: null }))
  const [shown, setShown] = useState(item.status === 'done')
  const waiting = item.status === 'queued' || item.status === 'drawing'
  const revealing = item.status === 'done' && !shown
  const imgId = item.img?.id

  useEffect(() => {
    const host = hostRef.current
    if (!waiting || !host || box.ht) return
    try {
      box.ht = mountHalftone(host, {
        startedAt: item.startedAt,
        model: item.model,
        edit: item.edit,
        i: index,
        small: true,
        queued: item.status === 'queued',
      })
    } catch {
      // No dot screen: the tile keeps its plain waiting colour.
      box.ht = null
    }
  }, [box, waiting, index, item.startedAt, item.model, item.edit, item.status])

  useEffect(() => {
    const ht = box.ht
    if (!ht) return
    if (item.status === 'queued') ht.setQueued(true)
    else if (item.status === 'drawing') {
      ht.setQueued(false)
      ht.setStarted(item.startedAt ?? Date.now())
    }
  }, [box, item.status, item.startedAt])

  useEffect(() => {
    if (item.status !== 'done' || shown) return
    const ht = box.ht
    if (!ht || !imgId) {
      setShown(true)
      return
    }
    let cancelled = false
    const run = async () => {
      const url = await loadImageUrl(imgId, 'thumb')
      if (cancelled) return
      if (url) {
        const img = new Image()
        img.alt = ''
        img.src = url
        await img.decode().catch(() => undefined)
        if (cancelled) return
        await ht.reveal(img).catch(() => undefined)
      }
      if (!cancelled) setShown(true)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [box, item.status, imgId, shown])

  // Done (picture shown), failed or stopped: the dot screen goes away.
  useLayoutEffect(() => {
    if (waiting || revealing) return
    box.ht?.destroy()
    box.ht = null
    hostRef.current?.replaceChildren()
  }, [box, waiting, revealing])

  useEffect(
    () => () => {
      box.ht?.destroy()
      box.ht = null
    },
    [box]
  )

  return { hostRef, shown }
}
