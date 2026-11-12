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
import { getImageBlob } from './storage'

/*
 * Object URLs for stored pictures, made once per picture and variant.
 * The full picture shows on the canvas and in the lightbox; the thumbnail
 * (at most THUMB_SIZE on the long side) everywhere else.
 */

const THUMB_SIZE = 640
const urls = new Map<string, string>()
/**
 * Full pictures made in this visit. Their object URLs keep the bytes alive
 * anyway; holding the Blob lets download and copy work for a picture that
 * could not be stored (full browser storage).
 */
const fresh = new Map<string, Blob>()
const loading = new Map<string, Promise<string | null>>()
const listeners = new Set<() => void>()

const urlKey = (id: string, variant: 'full' | 'thumb') => `${id}:${variant}`

export function cachedImageUrl(id: string, variant: 'full' | 'thumb') {
  return urls.get(urlKey(id, variant)) ?? null
}

export function loadImageUrl(
  id: string,
  variant: 'full' | 'thumb'
): Promise<string | null> {
  const key = urlKey(id, variant)
  const hit = urls.get(key)
  if (hit) return Promise.resolve(hit)
  const running = loading.get(key)
  if (running) return running
  const job = getImageBlob(id, variant)
    .then((blob) => {
      if (!blob) return null
      const url = URL.createObjectURL(blob)
      urls.set(key, url)
      listeners.forEach((fn) => fn())
      return url
    })
    .catch(() => null)
    .finally(() => loading.delete(key))
  loading.set(key, job)
  return job
}

/** Register blobs we already hold, so they show without a database read. */
export function primeImageUrls(id: string, blob: Blob, thumb?: Blob) {
  fresh.set(id, blob)
  if (!urls.has(urlKey(id, 'full'))) {
    urls.set(urlKey(id, 'full'), URL.createObjectURL(blob))
  }
  if (thumb && !urls.has(urlKey(id, 'thumb'))) {
    urls.set(urlKey(id, 'thumb'), URL.createObjectURL(thumb))
  }
  listeners.forEach((fn) => fn())
}

export function subscribeImageUrls(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function revokeImageUrls(ids: Iterable<string>) {
  for (const id of ids) {
    fresh.delete(id)
    for (const variant of ['full', 'thumb'] as const) {
      const key = urlKey(id, variant)
      const url = urls.get(key)
      if (url) URL.revokeObjectURL(url)
      urls.delete(key)
    }
  }
}

export function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob)
    } catch {
      // Fall through to an <img>, e.g. for formats the bitmap path rejects.
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

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))),
      type,
      quality
    )
  )
}

/** Size of a picture plus a small copy for thumbnails. */
export async function prepareImage(
  blob: Blob,
  keepAlpha: boolean
): Promise<{ w: number; h: number; thumb: Blob }> {
  const src = await decode(blob)
  const w = src.width
  const h = src.height
  const k = Math.min(1, THUMB_SIZE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * k))
  canvas.height = Math.max(1, Math.round(h * k))
  canvas.getContext('2d')?.drawImage(src, 0, 0, canvas.width, canvas.height)
  if ('close' in src) src.close()
  const thumb = keepAlpha
    ? await canvasBlob(canvas, 'image/webp', 0.86)
    : await canvasBlob(canvas, 'image/jpeg', 0.84)
  return { w, h, thumb }
}

/** Draws a stored picture into a canvas of the given width. */
export async function drawToCanvas(
  blob: Blob,
  width: number
): Promise<HTMLCanvasElement> {
  const src = await decode(blob)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width)
  canvas.height = Math.round((width * src.height) / src.width)
  canvas.getContext('2d')?.drawImage(src, 0, 0, canvas.width, canvas.height)
  if ('close' in src) src.close()
  return canvas
}

export { canvasBlob }

/**
 * The picture's bytes in memory. A stored or pasted picture the browser can
 * no longer read fails here instead of going out as a broken upload.
 */
export async function copyBlob(blob: Blob): Promise<Blob> {
  return new Blob([await blob.arrayBuffer()], { type: blob.type })
}

/** A small JPEG (white behind transparency) for the planner to look at. */
export async function smallJpeg(blob: Blob, max = 512): Promise<Blob> {
  const src = await decode(blob)
  const k = Math.min(1, max / Math.max(src.width, src.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(src.width * k))
  canvas.height = Math.max(1, Math.round(src.height * k))
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
  }
  if ('close' in src) src.close()
  return canvasBlob(canvas, 'image/jpeg', 0.8)
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () =>
      reject(reader.error ?? new Error('Could not read the picture'))
    )
    reader.readAsDataURL(blob)
  })
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** The full picture: from this visit's memory, else from the database. */
export async function fullImageBlob(id: string): Promise<Blob | null> {
  return fresh.get(id) ?? (await getImageBlob(id, 'full'))
}

async function fullBlob(id: string): Promise<Blob> {
  const blob = await fullImageBlob(id)
  if (!blob) throw new Error('Picture not found')
  return blob
}

export async function downloadImage(id: string) {
  const blob = await fullBlob(id)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `小熊画图-${stamp()}.${blob.type.includes('jpeg') ? 'jpg' : 'png'}`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Copies a picture as PNG; throws where the browser can't. */
export async function copyImageToClipboard(id: string) {
  const blob = await fullBlob(id)
  let png = blob
  if (blob.type !== 'image/png') {
    const src = await decode(blob)
    const canvas = document.createElement('canvas')
    canvas.width = src.width
    canvas.height = src.height
    canvas.getContext('2d')?.drawImage(src, 0, 0)
    png = await canvasBlob(canvas, 'image/png')
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}
