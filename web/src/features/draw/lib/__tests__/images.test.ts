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

import { downloadImage, primeImageUrls, revokeImageUrls } from '../images'
import { getImageBlob } from '../storage'

vi.mock('../storage', () => ({ getImageBlob: vi.fn() }))

describe('downloadImage', () => {
  let saved: Blob | null = null

  beforeEach(() => {
    saved = null
    // Nothing in the database: the picture could not be stored.
    vi.mocked(getImageBlob).mockResolvedValue(null)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (blob: Blob) => {
        saved = blob
        return 'blob:pic'
      },
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: () => undefined,
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  test('a picture from this visit downloads even when it was not stored', async () => {
    const pic = new Blob(['png'], { type: 'image/png' })
    primeImageUrls('i-unsaved', pic)
    saved = null

    await downloadImage('i-unsaved')
    expect(saved).toBe(pic)
  })

  test('once its urls are dropped it is looked up in the database again', async () => {
    primeImageUrls('i-gone', new Blob(['png'], { type: 'image/png' }))
    revokeImageUrls(['i-gone'])

    await expect(downloadImage('i-gone')).rejects.toThrow('Picture not found')
  })
})
