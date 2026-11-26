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
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { CanvasViewHandle } from '../canvas/canvas-view'

export type CanvasHandle = CanvasViewHandle

/** 对比 asked for from the chat waits this long for its pictures: 20 × 0.4 s. */
const COMPARE_TRIES = 20
const COMPARE_WAIT_MS = 400

/** The canvas pane slides open in 0.32 s; centre on pictures after that. */
const PANE_MS = 340

const reduced = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Centring the canvas on pictures from the chat. The canvas mounts only
 * when its pane opens, so a request made while it is closed waits until
 * the canvas is there and the pane has finished sliding open.
 */
export function useCanvasFocus() {
  const [box] = useState(() => ({
    handle: null as CanvasHandle | null,
    pending: null as string[] | null,
    compare: null as [string, string] | null,
    tries: 0,
    timer: 0,
    /** A hidden canvas is coming back: nothing centres before this time. */
    readyAt: 0,
  }))

  const flush = useCallback(
    (ms: number) => {
      window.clearTimeout(box.timer)
      const tick = () => {
        const ids = box.pending
        const pair = box.compare
        const handle = box.handle
        if (!handle) return
        box.pending = null
        if (ids) handle.focus(ids)
        if (!pair) return
        // Pictures of a canvas that just opened load from storage first.
        if (handle.compare(pair[0], pair[1]) || ++box.tries > COMPARE_TRIES) {
          box.compare = null
        } else {
          box.timer = window.setTimeout(tick, COMPARE_WAIT_MS)
        }
      }
      // a pane that is still opening has no final size to centre in
      const wait = Math.max(ms, box.readyAt - Date.now())
      box.timer = window.setTimeout(tick, wait)
    },
    [box]
  )

  /** Ref callback for the canvas. */
  const setHandle = useCallback(
    (handle: CanvasHandle | null) => {
      box.handle = handle
      if (handle) flush(reduced() ? 30 : PANE_MS)
    },
    [box, flush]
  )

  /** Centre on these pictures (or a set) now, or once the canvas is there. */
  const request = useCallback(
    (ids?: string[]) => {
      if (ids?.length) box.pending = ids
      if (box.handle) flush(0)
    },
    [box, flush]
  )

  /** Open 对比 on two pictures now, or once the canvas is there. */
  const compare = useCallback(
    (a: string, b: string) => {
      box.compare = [a, b]
      box.tries = 0
      if (box.handle) flush(0)
    },
    [box, flush]
  )

  /** The canvas pane was closed and is opening again (it stays mounted). */
  const opening = useCallback(() => {
    box.readyAt = Date.now() + (reduced() ? 30 : PANE_MS)
  }, [box])

  useEffect(() => () => window.clearTimeout(box.timer), [box])

  return useMemo(
    () => ({ setHandle, request, compare, opening }),
    [setHandle, request, compare, opening]
  )
}
