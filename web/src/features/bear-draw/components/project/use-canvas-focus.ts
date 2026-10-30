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
    timer: 0,
  }))

  const flush = useCallback(
    (ms: number) => {
      window.clearTimeout(box.timer)
      box.timer = window.setTimeout(() => {
        const ids = box.pending
        const handle = box.handle
        if (!ids || !handle) return
        box.pending = null
        handle.focus(ids)
      }, ms)
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

  useEffect(() => () => window.clearTimeout(box.timer), [box])

  return useMemo(() => ({ setHandle, request }), [setHandle, request])
}
