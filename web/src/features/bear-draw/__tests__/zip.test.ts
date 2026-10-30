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
import { describe, expect, test } from 'vitest'

import { crc32, makeZip, zipBytes } from '../lib/zip'

const enc = new TextEncoder()

type Entry = {
  name: string
  flags: number
  method: number
  time: number
  date: number
  crc: number
  data: Uint8Array
}

/** Reads a ZIP back through its end record and central directory. */
function readZip(bytes: Uint8Array): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.length - 22
  expect(view.getUint32(end, true)).toBe(0x06054b50)
  const count = view.getUint16(end + 10, true)
  const size = view.getUint32(end + 12, true)
  let p = view.getUint32(end + 16, true)
  expect(p + size).toBe(end)
  const out: Entry[] = []
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(p, true)).toBe(0x02014b50)
    const nameLen = view.getUint16(p + 28, true)
    const skip = view.getUint16(p + 30, true) + view.getUint16(p + 32, true)
    const local = view.getUint32(p + 42, true)
    const name = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + nameLen))
    expect(view.getUint32(local, true)).toBe(0x04034b50)
    const localName = view.getUint16(local + 26, true)
    const localExtra = view.getUint16(local + 28, true)
    const start = local + 30 + localName + localExtra
    const length = view.getUint32(local + 18, true)
    out.push({
      name,
      flags: view.getUint16(p + 8, true),
      method: view.getUint16(p + 10, true),
      time: view.getUint16(p + 12, true),
      date: view.getUint16(p + 14, true),
      crc: view.getUint32(p + 16, true),
      data: bytes.slice(start, start + length),
    })
    p += 46 + nameLen + skip
  }
  return out
}

describe('crc32', () => {
  test('matches the standard check value for "123456789"', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926)
  })
})

describe('zipBytes', () => {
  test('two files read back with their names, bytes and checksums', () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3])
    const entries = readZip(
      zipBytes([
        { name: '淘宝-1-首图-800x800.jpg', data: jpg },
        { name: 'copy.txt', data: enc.encode('hello') },
      ])
    )
    expect(entries.map((e) => e.name)).toEqual([
      '淘宝-1-首图-800x800.jpg',
      'copy.txt',
    ])
    expect([...entries[0].data]).toEqual([...jpg])
    expect(new TextDecoder().decode(entries[1].data)).toBe('hello')
    expect(entries[1].crc).toBe(0x3610a686)
  })

  test('entries are stored uncompressed with the UTF-8 name flag', () => {
    const [entry] = readZip(
      zipBytes([{ name: '首图.jpg', data: enc.encode('x') }])
    )
    expect(entry.method).toBe(0)
    expect(entry.flags & 0x0800).toBe(0x0800)
  })

  test('the given date is stored as MS-DOS time and date', () => {
    const at = new Date(2026, 9, 25, 14, 30, 58)
    const [entry] = readZip(
      zipBytes([{ name: 'a', data: enc.encode('a') }], at)
    )
    expect(entry.time).toBe((14 << 11) | (30 << 5) | 29)
    expect(entry.date).toBe(((2026 - 1980) << 9) | (10 << 5) | 25)
  })

  test('no files gives a valid empty archive', () => {
    const bytes = zipBytes([])
    expect(bytes.length).toBe(22)
    expect(readZip(bytes)).toEqual([])
  })

  test('names cannot climb out of the folder', () => {
    const entries = readZip(
      zipBytes([
        { name: '../evil/../x.jpg', data: enc.encode('1') },
        { name: '\\set\\a.jpg', data: enc.encode('2') },
      ])
    )
    expect(entries.map((e) => e.name)).toEqual(['evil/x.jpg', 'set/a.jpg'])
  })
})

describe('makeZip', () => {
  test('returns the archive as an application/zip Blob', () => {
    const files = [{ name: 'a.txt', data: enc.encode('abc') }]
    const blob = makeZip(files)
    expect(blob.type).toBe('application/zip')
    expect(blob.size).toBe(zipBytes(files).length)
  })
})
