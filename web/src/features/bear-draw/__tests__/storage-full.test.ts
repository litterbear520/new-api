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
import { afterEach, describe, expect, test, vi } from 'vitest'

import { putImage } from '@/features/draw/lib/storage'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { UnreadablePictureError, storeFiles } from '../lib/attachments'
import type { Skill } from '../types'

vi.mock('@/features/draw/lib/images', async (original) => ({
  ...(await original<typeof import('@/features/draw/lib/images')>()),
  copyBlob: vi.fn(async (b: Blob) => b),
  prepareImage: vi.fn(async () => ({
    w: 1,
    h: 1,
    thumb: undefined,
    clear: false,
  })),
  primeImageUrls: vi.fn(),
}))
vi.mock('@/features/draw/lib/storage', async (original) => ({
  ...(await original<typeof import('@/features/draw/lib/storage')>()),
  putImage: vi.fn(async () => {}),
  requestPersistence: vi.fn(),
}))

const file = (name: string, type: string) => new File(['x'], name, { type })

afterEach(() => vi.restoreAllMocks())

describe('storing pictures', () => {
  test('a type the page cannot use is skipped, the rest are stored', async () => {
    const out = await storeFiles([
      file('logo.svg', 'image/svg+xml'),
      file('a.png', 'image/png'),
    ])
    expect(out.map((a) => a.name)).toEqual(['a.png'])
  })

  test('full storage is not reported as an unreadable picture', async () => {
    vi.mocked(putImage).mockRejectedValueOnce(
      new DOMException('full', 'QuotaExceededError')
    )
    const error = await storeFiles([file('a.png', 'image/png')]).catch((e) => e)
    expect(error).not.toBeInstanceOf(UnreadablePictureError)
    expect((error as DOMException).name).toBe('QuotaExceededError')
  })
})

describe('my skills', () => {
  test('a skill the browser cannot keep is not added', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const before = useBearDrawStore.getState().mySkills
    const ok = useBearDrawStore
      .getState()
      .putMySkill({ id: 'big', name: 'big' } as unknown as Skill)
    expect(ok).toBe(false)
    expect(useBearDrawStore.getState().mySkills).toBe(before)
  })
})
