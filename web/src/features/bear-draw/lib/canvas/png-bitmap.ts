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

/*
 * The worker half of encodePng (png-encode.ts): a canvas snapshot in, PNG
 * bytes out. No imports, so the worker bundle stays this file.
 */

export type PngRequest = { bitmap: ImageBitmap }

export type PngReply =
  | { ok: true; blob: Blob }
  /** no-2d: this browser's workers have OffscreenCanvas but no 2d context. */
  | { ok: false; reason: 'no-2d' | 'failed' }

export async function pngFromBitmap(bitmap: ImageBitmap): Promise<PngReply> {
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return { ok: false, reason: 'no-2d' }
    // Same size, no transform: the pixels are copied as they are.
    ctx.drawImage(bitmap, 0, 0)
    return { ok: true, blob: await canvas.convertToBlob({ type: 'image/png' }) }
  } catch {
    return { ok: false, reason: 'failed' }
  } finally {
    bitmap.close()
  }
}
