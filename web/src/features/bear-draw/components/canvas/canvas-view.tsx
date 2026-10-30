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
import { forwardRef, useImperativeHandle, type ChangeEvent } from 'react'

import { type CanvasViewProps, useCanvasView } from './use-canvas-view'

export type { CanvasViewProps } from './use-canvas-view'

export type CanvasViewHandle = {
  /** Moves the camera to these frames or pictures and selects them. */
  focus: (ids: string[]) => void
  fit: () => void
}

/**
 * The project's infinite canvas (lib/canvas) inside React: frames and
 * pictures from the project, 「点阵显影」 while they draw, moves saved back.
 * Fills its parent.
 */
export const CanvasView = forwardRef<CanvasViewHandle, CanvasViewProps>(
  function CanvasView(props, ref) {
    const view = useCanvasView(props)

    useImperativeHandle(
      ref,
      () => ({
        focus: (ids) => {
          const cv = view.cvRef.current
          if (!cv || !ids.length) return
          cv.focus(ids, { animate: true })
          cv.select(ids)
        },
        fit: () => view.cvRef.current?.fit(),
      }),
      [view.cvRef]
    )

    const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
      const files = [...(e.currentTarget.files ?? [])]
      e.currentTarget.value = ''
      if (files.length) props.onUpload(files)
    }

    return (
      <div ref={view.hostRef} className='bd-cv-host'>
        <input
          ref={view.fileRef}
          type='file'
          accept='image/*'
          multiple
          hidden
          tabIndex={-1}
          onChange={onFiles}
        />
      </div>
    )
  }
)
