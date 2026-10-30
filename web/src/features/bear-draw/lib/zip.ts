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
 * A store-only ZIP writer (no compression: JPEG/PNG don't shrink anyway).
 * Names are UTF-8 with flag bit 11 set, so 淘宝-1-首图.jpg opens correctly
 * in Finder, Windows Explorer and unzip. No ZIP64: under 4 GB, 65535 files.
 */

export type ZipFile = { name: string; data: Uint8Array }

const UTF8_FLAG = 0x0800
const VERSION = 20

let crcTable: Uint32Array | null = null

function table(): Uint32Array {
  if (crcTable) return crcTable
  crcTable = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crcTable[n] = c >>> 0
  }
  return crcTable
}

/** CRC-32 (IEEE), as ZIP stores it. */
export function crc32(data: Uint8Array): number {
  const t = table()
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** MS-DOS time and date fields (local time, 2-second steps, from 1980). */
export function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.min(Math.max(d.getFullYear(), 1980), 2107)
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

/** A safe entry name: forward slashes, no leading slash or ../ parts. */
function entryName(name: string): string {
  return name
    .replaceAll('\\', '/')
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..')
    .join('/')
}

/** The ZIP file's bytes. */
export function zipBytes(
  files: ZipFile[],
  modified = new Date()
): Uint8Array<ArrayBuffer> {
  if (files.length > 0xffff) throw new Error('Too many files for one ZIP')
  const enc = new TextEncoder()
  const { time, date } = dosDateTime(modified)
  const entries = files.map((f) => ({
    name: enc.encode(entryName(f.name) || 'file'),
    data: f.data,
    crc: crc32(f.data),
  }))
  const localSize = entries.reduce(
    (s, e) => s + 30 + e.name.length + e.data.length,
    0
  )
  const centralSize = entries.reduce((s, e) => s + 46 + e.name.length, 0)
  const total = localSize + centralSize + 22
  if (total > 0xffffffff) throw new Error('The ZIP would be larger than 4 GB')

  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  let p = 0
  const u16 = (v: number) => {
    view.setUint16(p, v, true)
    p += 2
  }
  const u32 = (v: number) => {
    view.setUint32(p, v >>> 0, true)
    p += 4
  }
  const bytes = (b: Uint8Array) => {
    out.set(b, p)
    p += b.length
  }
  /* version needed, flags, method 0 (stored), time, date, crc, sizes, name length */
  const common = (e: (typeof entries)[number]) => {
    u16(VERSION)
    u16(UTF8_FLAG)
    u16(0)
    u16(time)
    u16(date)
    u32(e.crc)
    u32(e.data.length)
    u32(e.data.length)
    u16(e.name.length)
  }

  const offsets: number[] = []
  for (const e of entries) {
    offsets.push(p)
    u32(0x04034b50)
    common(e)
    u16(0) // extra field length
    bytes(e.name)
    bytes(e.data)
  }
  const centralStart = p
  entries.forEach((e, i) => {
    u32(0x02014b50)
    u16(VERSION) // made by: MS-DOS attributes, spec 2.0
    common(e)
    u16(0) // extra field length
    u16(0) // comment length
    u16(0) // disk number
    u16(0) // internal attributes
    u32(0) // external attributes
    u32(offsets[i])
    bytes(e.name)
  })
  const centralEnd = p
  u32(0x06054b50)
  u16(0) // this disk
  u16(0) // disk with the central directory
  u16(entries.length)
  u16(entries.length)
  u32(centralEnd - centralStart)
  u32(centralStart)
  u16(0) // comment length
  return out
}

/** Packs the files into a ZIP (stored, UTF-8 names). */
export function makeZip(files: ZipFile[], modified?: Date): Blob {
  return new Blob([zipBytes(files, modified)], { type: 'application/zip' })
}
