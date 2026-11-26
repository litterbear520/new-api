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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UPLOAD_MAX_PX, uploadCopy } from '../lib/images'

/** A fake 2D canvas: remembers its size and answers with the alpha given. */
let alpha = 255
let made: Array<{ width: number; height: number; type?: string; q?: number }>

beforeEach(() => {
  alpha = 255
  made = []
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (blob: Blob) => {
      const [w, h] = (await blob.text()).split('x').map(Number)
      if (!w) throw new Error('not a picture')
      return { width: w, height: h, close() {} }
    })
  )
  const real = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') return real(tag)
    const c = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, alpha]) }),
      }),
      toBlob(cb: (b: Blob) => void, type: string, q: number) {
        made.push({ width: c.width, height: c.height, type, q })
        cb(new Blob(['jpeg'], { type }))
      },
    }
    return c as unknown as HTMLElement
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const picture = (size: string, type = 'image/png') => new Blob([size], { type })

describe('the copy of a picture sent with an edit', () => {
  it('is a JPEG at 0.92 when nothing is transparent', async () => {
    const out = await uploadCopy(picture('1536x1024'))
    expect(out.type).toBe('image/jpeg')
    expect(made).toEqual([
      { width: 1536, height: 1024, type: 'image/jpeg', q: 0.92 },
    ])
  })

  it('is no longer than 2048 on its long side', async () => {
    await uploadCopy(picture('4096x2048'))
    expect(made[0]).toMatchObject({ width: UPLOAD_MAX_PX, height: 1024 })
  })

  it('stays a PNG when the picture has transparency', async () => {
    alpha = 0
    const out = await uploadCopy(picture('800x800'))
    expect(out.type).toBe('image/png')
    expect(await out.text()).toBe('800x800')
    expect(made).toEqual([])
  })

  it('stays a PNG when it is only slightly transparent', async () => {
    alpha = 252
    expect((await uploadCopy(picture('800x800'))).type).toBe('image/png')
  })

  it('leaves a JPEG that is small enough as it is', async () => {
    const out = await uploadCopy(picture('1024x1024', 'image/jpeg'))
    expect(await out.text()).toBe('1024x1024')
    expect(made).toEqual([])
  })

  it('goes out as it is when the browser cannot redraw it', async () => {
    const out = await uploadCopy(picture('broken'))
    expect(await out.text()).toBe('broken')
  })
})
