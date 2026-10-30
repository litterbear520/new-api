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
import type { ChatImage } from '../types'

/** Pictures per message. */
export const MAX_IMAGES = 6
/** Long side sent to the model; larger pictures cost more and add little. */
export const MAX_SIDE = 1568
/** Small files that already fit are sent as they are. */
const KEEP_BYTES = 900 * 1024
const KEEP_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

let seq = 0
const newImageId = () => `i${Date.now().toString(36)}${(++seq).toString(36)}`

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () =>
      reject(reader.error ?? new Error('Read failed'))
    )
    reader.readAsDataURL(blob)
  })
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob)
    } catch {
      // fall back to <img>, e.g. for formats the bitmap path rejects
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/** Reads a picture and shrinks it to at most MAX_SIDE on the long side. */
export async function readImage(file: File): Promise<ChatImage> {
  const src = await decode(file)
  const w = src.width
  const h = src.height
  const k = Math.min(1, MAX_SIDE / Math.max(w, h))
  let url: string
  if (k === 1 && file.size <= KEEP_BYTES && KEEP_TYPES.has(file.type)) {
    url = await readAsDataUrl(file)
  } else {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * k))
    canvas.height = Math.max(1, Math.round(h * k))
    canvas.getContext('2d')?.drawImage(src, 0, 0, canvas.width, canvas.height)
    // Safari cannot encode WebP and hands back PNG, which is still fine
    url = canvas.toDataURL('image/webp', 0.9)
  }
  if ('close' in src) src.close()
  return {
    id: newImageId(),
    url,
    name: file.name || undefined,
    w: Math.round(w * k),
    h: Math.round(h * k),
  }
}

/** Adds picture files to a message; returns how many were skipped. */
export async function addPictures(
  files: File[],
  current: ChatImage[],
  set: (next: ChatImage[]) => void
): Promise<number> {
  const picked = files.filter(isImageFile)
  const take = picked.slice(0, Math.max(0, MAX_IMAGES - current.length))
  const read = await Promise.all(
    take.map((f) => readImage(f).catch(() => null))
  )
  const ok = read.filter((x): x is ChatImage => x !== null)
  if (ok.length) set([...current, ...ok])
  return picked.length - ok.length
}
