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
import {
  isQuotaError,
  putImage,
  requestPersistence,
} from '@/features/draw/lib/storage'
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
  return {
    id,
    w: prepared.w,
    h: prepared.h,
    ...(prepared.clear ? { clear: true } : {}),
    ...(name ? { name } : {}),
  }
}

/**
 * Stores image files, skipping types the page cannot use (fewer come back
 * than went in). Throws UnreadablePictureError on the first bad one, and the
 * storage's QuotaExceededError when the browser is full.
 */
export async function storeFiles(files: File[]): Promise<Attachment[]> {
  const out: Attachment[] = []
  for (const file of files) {
    if (!IMAGE_TYPES.test(file.type)) continue
    try {
      out.push(await storeBlob(file, file.name))
    } catch (error) {
      if (isQuotaError(error)) throw error
      throw new UnreadablePictureError(file.name)
    }
  }
  return out
}

/** What to tell the user when storing pictures failed. */
export function storeFailedText(error: unknown): string {
  return isQuotaError(error)
    ? 'Browser storage is full, so the picture was not added. Delete old projects to free space.'
    : "Couldn't read that picture; try another one"
}

export const SKIPPED_PICTURES_TEXT =
  'Some files were skipped: this page takes PNG, JPEG, WebP, GIF, BMP, AVIF and HEIC pictures.'

/** Stores a picture made on the page (e.g. one with red marks drawn on). */
export function storePicture(blob: Blob): Promise<Attachment> {
  return storeBlob(blob)
}
