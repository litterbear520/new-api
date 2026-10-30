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
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getImageBlob } from '@/features/draw/lib/storage'

import { SKILLS } from '../data/skills'
import {
  coverCrop,
  exportFileName,
  exportGroup,
  parseSize,
  safeName,
} from '../lib/export'
import type { CanvasNode, Project } from '../types'

vi.mock('@/features/draw/lib/storage', () => ({ getImageBlob: vi.fn() }))

describe('parseSize', () => {
  test('reads W×H, also with x', () => {
    expect(parseSize('800×800')).toEqual({ w: 800, h: 800 })
    expect(parseSize('1080x1440')).toEqual({ w: 1080, h: 1440 })
  })

  test('anything else means "keep the original size"', () => {
    expect(parseSize('750 宽')).toBeNull()
    expect(parseSize(undefined)).toBeNull()
    expect(parseSize('8×8')).toBeNull()
  })

  test('every built-in deliverable size is W×H', () => {
    const sizes = SKILLS.flatMap((s) => s.deliverables.map((d) => d.size))
    expect(sizes.filter((s) => !parseSize(s))).toEqual([])
  })
})

describe('coverCrop', () => {
  test('a 2:3 picture cut to 4:5 loses equal strips at top and bottom', () => {
    expect(coverCrop(1024, 1536, 1080, 1350)).toEqual({
      sx: 0,
      sy: 128,
      sw: 1024,
      sh: 1280,
    })
  })

  test('a 3:2 picture cut to a square keeps the middle', () => {
    expect(coverCrop(1536, 1024, 800, 800)).toEqual({
      sx: 256,
      sy: 0,
      sw: 1024,
      sh: 1024,
    })
  })
})

describe('exportFileName', () => {
  test('platform, number, label and size', () => {
    expect(
      exportFileName({
        prefix: '淘宝',
        index: 0,
        label: '首图',
        w: 800,
        h: 800,
        png: false,
      })
    ).toBe('淘宝-1-首图-800x800.jpg')
  })

  test('characters file systems refuse become spaces; transparent is PNG', () => {
    expect(
      exportFileName({
        prefix: 'A/B: C',
        index: 1,
        label: '卖点*图?',
        w: 600,
        h: 600,
        png: true,
      })
    ).toBe('A B C-2-卖点 图-600x600.png')
  })

  test('no prefix or label falls back to 小熊画图 and skips the label', () => {
    expect(
      exportFileName({
        prefix: ' ',
        index: 2,
        label: '',
        w: 1,
        h: 2,
        png: false,
      })
    ).toBe('小熊画图-3-1x2.jpg')
  })

  test('safeName strips dots at the ends and caps the length', () => {
    expect(safeName('..hidden..')).toBe('hidden')
    expect([...safeName('图'.repeat(80))]).toHaveLength(60)
  })
})

describe('exportGroup', () => {
  const jpeg = (n: number) =>
    new Blob([new Uint8Array([0xff, 0xd8, n])], { type: 'image/jpeg' })
  const node = (id: string, status: CanvasNode['status']): CanvasNode => ({
    id,
    groupId: 'g1',
    status,
    img: status === 'ready' ? { id: `img-${id}`, w: 1024, h: 1024 } : undefined,
    w: 1024,
    h: 1024,
    label: id === 'n1' ? '首图' : '细节图',
    meta: {},
  })
  const project = (children: string[]): Project => ({
    id: 'p1',
    title: '保温杯',
    createdAt: 0,
    updatedAt: 0,
    cost: 0,
    messages: [],
    transcript: [],
    groups: [{ id: 'g1', title: '主图套图', platform: '淘宝', children }],
    nodes: [node('n1', 'ready'), node('n2', 'pending'), node('n3', 'ready')],
  })
  let saved: Blob | null = null
  let savedName = ''

  beforeEach(() => {
    saved = null
    savedName = ''
    vi.mocked(getImageBlob).mockImplementation(async (id) =>
      jpeg(id === 'img-n1' ? 1 : 3)
    )
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (blob: Blob) => {
        saved = blob
        return 'blob:zip'
      },
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: () => undefined,
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      savedName = this.download
    })
  })

  /** The downloaded ZIP's bytes as text, enough to find the file names. */
  async function savedText(): Promise<string> {
    if (!saved) throw new Error('Nothing was downloaded')
    return new TextDecoder().decode(await saved.arrayBuffer())
  }

  test('ready pictures go into one ZIP in frame order, named for upload', async () => {
    const count = await exportGroup(project(['n1', 'n2', 'n3']), 'g1')
    expect(count).toBe(2)
    expect(savedName).toBe('主图套图.zip')
    const text = await savedText()
    expect(text).toContain('淘宝-1-首图-1024x1024.jpg')
    expect(text).toContain('淘宝-2-细节图-1024x1024.jpg')
  })

  test('nothing ready: no download and 0', async () => {
    const count = await exportGroup(project(['n2']), 'g1')
    expect(count).toBe(0)
    expect(saved).toBeNull()
  })

  test('a picture missing from storage is left out', async () => {
    vi.mocked(getImageBlob).mockImplementation(async (id) =>
      id === 'img-n1' ? null : jpeg(3)
    )
    const count = await exportGroup(project(['n1', 'n3']), 'g1')
    expect(count).toBe(1)
    expect(await savedText()).toContain('淘宝-1-细节图-1024x1024.jpg')
  })
})
