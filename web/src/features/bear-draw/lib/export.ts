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
import { canvasBlob } from '@/features/draw/lib/images'
import { getImageBlob } from '@/features/draw/lib/storage'

import type { CanvasNode, ImageRef, Project } from '../types'
import { makeZip, type ZipFile } from './zip'

/*
 * 「打包下载」: a frame's finished pictures as one ZIP, each cut to its
 * delivery size (800×800 for a Taobao main picture) and named by platform
 * and use, ready to upload.
 */

/** Used when a frame has neither platform nor title. */
const FALLBACK_NAME = '小熊画图'
const JPEG_QUALITY = 0.92

/** A delivery size such as 800×800 (also 800x800); null for 750 宽 etc. */
export function parseSize(
  size: string | undefined
): { w: number; h: number } | null {
  const m = /^\s*(\d{2,5})\s*[×xX*]\s*(\d{2,5})\s*$/.exec(size ?? '')
  if (!m) return null
  const w = Number(m[1])
  const h = Number(m[2])
  if (Math.min(w, h) < 16 || Math.max(w, h) > 8192) return null
  return { w, h }
}

/**
 * The part of a src picture that, scaled, covers w×h exactly and stays
 * centred (CSS object-fit: cover).
 */
export function coverCrop(
  srcW: number,
  srcH: number,
  w: number,
  h: number
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(w / srcW, h / srcH)
  const sw = Math.min(srcW, w / scale)
  const sh = Math.min(srcH, h / scale)
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh }
}

/** A file-name part without the characters Windows and macOS refuse. */
export function safeName(part: string, fallback = ''): string {
  const visible = [...part]
    .map((c) => (c < ' ' || c === '\u007f' ? ' ' : c))
    .join('')
  const clean = visible
    .replaceAll(/[\\/:*?"<>|]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .replaceAll(/^\.+|\.+$/g, '')
    .trim()
  const chars = [...clean]
  return (
    (chars.length > 60 ? chars.slice(0, 60).join('').trim() : clean) || fallback
  )
}

/** 淘宝-1-首图-800x800.jpg: platform (or frame title), number, label, size. */
export function exportFileName(opts: {
  prefix: string
  index: number
  label: string
  w: number
  h: number
  png: boolean
}): string {
  const parts = [
    safeName(opts.prefix, FALLBACK_NAME),
    String(opts.index + 1),
    safeName(opts.label),
    `${opts.w}x${opts.h}`,
  ].filter(Boolean)
  return `${parts.join('-')}.${opts.png ? 'png' : 'jpg'}`
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob)
    } catch {
      // Fall through to an <img> for formats the bitmap path rejects.
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

type Rendered = { data: Uint8Array; w: number; h: number; png: boolean }

/** One picture as delivered: cut to its size, JPEG (PNG when transparent). */
async function render(
  node: CanvasNode,
  img: ImageRef
): Promise<Rendered | null> {
  const blob = await getImageBlob(img.id, 'full')
  if (!blob) return null
  const png = Boolean(img.clear)
  const type = png ? 'image/png' : 'image/jpeg'
  const target = parseSize(node.meta.size)
  if (!target && blob.type === type) {
    // Already the right format and size: keep the original bytes.
    return {
      data: new Uint8Array(await blob.arrayBuffer()),
      w: img.w,
      h: img.h,
      png,
    }
  }
  const src = await decode(blob)
  try {
    const w = target?.w ?? src.width
    const h = target?.h ?? src.height
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    if (!png) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.imageSmoothingQuality = 'high'
    const c = coverCrop(src.width, src.height, w, h)
    ctx.drawImage(src, c.sx, c.sy, c.sw, c.sh, 0, 0, w, h)
    const out = await canvasBlob(canvas, type, png ? undefined : JPEG_QUALITY)
    return { data: new Uint8Array(await out.arrayBuffer()), w, h, png }
  } finally {
    if ('close' in src) src.close()
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Downloads a frame's finished pictures, in frame order, as
 * `${group.title}.zip`. Pictures that can't be read are left out.
 * Returns how many went in (0: nothing downloaded).
 */
export async function exportGroup(
  project: Project,
  groupId: string
): Promise<number> {
  const group = project.groups.find((g) => g.id === groupId)
  if (!group) return 0
  const byId = new Map(project.nodes.map((n) => [n.id, n]))
  const prefix = group.platform || group.title
  const files: ZipFile[] = []
  for (const id of group.children) {
    const node = byId.get(id)
    if (node?.status !== 'ready' || !node.img) continue
    const pic = await render(node, node.img).catch(() => null)
    if (!pic) continue
    files.push({
      name: exportFileName({
        prefix,
        index: files.length,
        label: node.label,
        w: pic.w,
        h: pic.h,
        png: pic.png,
      }),
      data: pic.data,
    })
  }
  if (!files.length) return 0
  download(makeZip(files), `${safeName(group.title, FALLBACK_NAME)}.zip`)
  return files.length
}
