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
import {
  copyBlob,
  prepareImage,
  primeImageUrls,
} from '@/features/draw/lib/images'
import { putImage, requestPersistence } from '@/features/draw/lib/storage'
import { useAuthStore } from '@/stores/auth-store'
import { newId, useBearDrawStore } from '@/stores/bear-draw-store'

import type { Attachment } from '../types'

/*
 * Pictures the user brings (composer, canvas upload, brand logo) go into
 * the same IndexedDB store as drawn ones. The bytes are copied into memory
 * first: a pasted or dropped File can become unreadable later, and a broken
 * upload would still be billed.
 */

export class UnreadablePictureError extends Error {
  constructor(public fileName: string) {
    super('This picture cannot be read')
  }
}

const IMAGE_TYPES = /^image\/(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i

function uid(): number {
  return (
    useBearDrawStore.getState().uid ??
    useAuthStore.getState().auth.user?.id ??
    0
  )
}

async function storeBlob(blob: Blob, name?: string): Promise<Attachment> {
  const bytes = await copyBlob(blob)
  const keepAlpha = bytes.type === 'image/png' || bytes.type === 'image/webp'
  const prepared = await prepareImage(bytes, keepAlpha)
  const id = newId('u')
  primeImageUrls(id, bytes, prepared.thumb)
  await putImage(uid(), id, bytes, prepared.thumb)
  requestPersistence()
  return { id, w: prepared.w, h: prepared.h, ...(name ? { name } : {}) }
}

/** Stores image files; throws UnreadablePictureError on the first bad one. */
export async function storeFiles(files: File[]): Promise<Attachment[]> {
  const out: Attachment[] = []
  for (const file of files) {
    if (!IMAGE_TYPES.test(file.type)) continue
    try {
      out.push(await storeBlob(file, file.name))
    } catch {
      throw new UnreadablePictureError(file.name)
    }
  }
  return out
}

/** Stores a PNG data URL (e.g. a picture with red marks drawn on it). */
export async function storeDataUrl(dataUrl: string): Promise<Attachment> {
  const blob = await (await fetch(dataUrl)).blob()
  return storeBlob(blob)
}
