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
import type { PngReply } from './png-bitmap'

/*
 * A canvas as a PNG Blob without blocking the page: Chrome and Safari both
 * encode toDataURL on the main thread (2048 px: 135 ms on an M4, 750 ms on a
 * slow phone), and Safari's toBlob too. A worker encodes a snapshot of the
 * canvas instead; where it can't (no OffscreenCanvas, or no 2d context in
 * workers before Safari 16.4), the canvas's own toBlob.
 */

/** Set once a worker said it can't encode here; later calls skip it. */
let workerUnusable = false

function workerPossible(): boolean {
  return (
    !workerUnusable &&
    typeof Worker === 'function' &&
    typeof OffscreenCanvas === 'function' &&
    typeof createImageBitmap === 'function'
  )
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))),
      'image/png'
    )
  )
}

async function encodeInWorker(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const bitmap = await createImageBitmap(canvas)
  const worker = new Worker(
    new URL('./png-encode.worker.ts', import.meta.url),
    {
      type: 'module',
    }
  )
  try {
    return await new Promise<Blob | null>((resolve) => {
      worker.addEventListener('message', (e: MessageEvent<PngReply>) => {
        if (e.data.ok) return resolve(e.data.blob)
        if (e.data.reason === 'no-2d') workerUnusable = true
        resolve(null)
      })
      worker.addEventListener('messageerror', () => resolve(null))
      // The worker script itself failed (e.g. blocked or not loadable).
      worker.addEventListener('error', () => {
        workerUnusable = true
        resolve(null)
      })
      worker.postMessage({ bitmap }, [bitmap])
    })
  } finally {
    worker.terminate()
  }
}

/** The canvas as image/png, the same pixels toDataURL would give. */
export async function encodePng(canvas: HTMLCanvasElement): Promise<Blob> {
  if (workerPossible()) {
    const blob = await encodeInWorker(canvas).catch(() => null)
    if (blob) return blob
  }
  return toBlob(canvas)
}
