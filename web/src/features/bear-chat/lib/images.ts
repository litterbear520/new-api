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

/** Types whose pictures can have transparent pixels. */
const ALPHA_TYPES = new Set(['image/png', 'image/webp', 'image/gif'])
const WEBP_QUALITY = 0.9
const JPEG_QUALITY = 0.85
/** Side of the grid read back to look for transparent pixels. */
const ALPHA_SAMPLE = 64

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

let webpEncodes: boolean | undefined

/** Safari cannot encode WebP; asked for it, canvas hands back PNG instead. */
function canEncodeWebp(): boolean {
  if (webpEncodes === undefined) {
    const probe = document.createElement('canvas')
    probe.width = 1
    probe.height = 1
    const url: string | null = probe.toDataURL('image/webp')
    webpEncodes = Boolean(url?.startsWith('data:image/webp'))
  }
  return webpEncodes
}

/** Looks for a transparent pixel on a 64 × 64 grid over the picture. */
function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const grid = document.createElement('canvas')
  grid.width = Math.min(ALPHA_SAMPLE, canvas.width)
  grid.height = Math.min(ALPHA_SAMPLE, canvas.height)
  const ctx = grid.getContext('2d', { willReadFrequently: true })
  // cannot tell: keep the format that holds transparency
  if (!ctx) return true
  ctx.drawImage(canvas, 0, 0, grid.width, grid.height)
  const px = ctx.getImageData(0, 0, grid.width, grid.height).data
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] < 255) return true
  }
  return false
}

/** toBlob encodes off the main thread in Chrome; toDataURL never does. */
async function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<{ url: string; type: string }> {
  const blob =
    typeof canvas.toBlob === 'function'
      ? await new Promise<Blob | null>((done) =>
          canvas.toBlob(done, type, quality)
        )
      : null
  if (blob) return { url: await readAsDataUrl(blob), type: blob.type }
  const url = canvas.toDataURL(type, quality)
  return { url, type: url.slice(5, url.indexOf(';')) }
}

/**
 * WebP where the browser can encode it. Elsewhere (Safari) PNG is several MB
 * per photo, so photos go as JPEG and only pictures with transparent pixels
 * stay PNG.
 */
async function encodePicture(
  canvas: HTMLCanvasElement,
  sourceType: string
): Promise<string> {
  if (canEncodeWebp()) {
    const webp = await encode(canvas, 'image/webp', WEBP_QUALITY)
    if (webp.type === 'image/webp') return webp.url
    webpEncodes = false
  }
  if (ALPHA_TYPES.has(sourceType) && hasTransparency(canvas)) {
    return (await encode(canvas, 'image/png')).url
  }
  return (await encode(canvas, 'image/jpeg', JPEG_QUALITY)).url
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
    if ('close' in src) src.close()
    url = await readAsDataUrl(file)
  } else {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * k))
    canvas.height = Math.max(1, Math.round(h * k))
    canvas.getContext('2d')?.drawImage(src, 0, 0, canvas.width, canvas.height)
    // the canvas holds the pixels now; free the bitmap while encoding
    if ('close' in src) src.close()
    url = await encodePicture(canvas, file.type)
  }
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
  set: (update: (prev: ChatImage[]) => ChatImage[]) => void
): Promise<number> {
  const picked = files.filter(isImageFile)
  const take = picked.slice(0, Math.max(0, MAX_IMAGES - current.length))
  const read = await Promise.all(
    take.map((f) => readImage(f).catch(() => null))
  )
  const ok = read.filter((x): x is ChatImage => x !== null)
  // Another paste may have landed while these were decoding.
  if (ok.length) set((prev) => [...prev, ...ok].slice(0, MAX_IMAGES))
  return picked.length - ok.length
}
