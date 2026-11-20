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

import type { ChatImage } from '../../types'
import { MAX_IMAGES, addPictures } from '../images'

/** createImageBitmap that answers in the order the test releases it. */
function slowDecoder() {
  const pending: Array<() => void> = []
  vi.stubGlobal(
    'createImageBitmap',
    () =>
      new Promise((resolve) =>
        pending.push(() => resolve({ width: 10, height: 10, close() {} }))
      )
  )
  return pending
}

const png = (name: string) => new File(['x'], name, { type: 'image/png' })

function draft() {
  let images: ChatImage[] = []
  const set = (update: (prev: ChatImage[]) => ChatImage[]) => {
    images = update(images)
  }
  return { set, get: () => images }
}

describe('addPictures', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('a second paste does not drop pictures still decoding', async () => {
    const release = slowDecoder()
    const d = draft()
    const first = addPictures([png('a.png')], d.get(), d.set)
    const second = addPictures([png('b.png')], d.get(), d.set)
    await vi.waitFor(() => expect(release).toHaveLength(2))
    release[1]()
    await second
    release[0]()
    await first
    expect(d.get().map((img) => img.name)).toEqual(['b.png', 'a.png'])
  })

  test('never holds more than the limit', async () => {
    const release = slowDecoder()
    const d = draft()
    const files = Array.from({ length: MAX_IMAGES }, (_, i) => png(`${i}.png`))
    const both = [
      addPictures(files, d.get(), d.set),
      addPictures([png('extra.png')], d.get(), d.set),
    ]
    await vi.waitFor(() => expect(release).toHaveLength(MAX_IMAGES + 1))
    for (const go of release) go()
    await Promise.all(both)
    expect(d.get()).toHaveLength(MAX_IMAGES)
  })
})

/**
 * A canvas that encodes like Chrome (WebP) or like Safari (asked for WebP,
 * gives PNG). `alpha` is what getImageData reads back.
 */
function fakeCanvas(opts: {
  webp: boolean
  alpha?: number
  /** false: toBlob calls back with null, as for a canvas it cannot encode. */
  blob?: boolean
}) {
  const syncEncodes: Array<{ w: number; type: string }> = []
  const blobs: Array<{ type: string; quality?: number }> = []
  const actual = (type: string) =>
    type === 'image/webp' && !opts.webp ? 'image/png' : type
  const proto = HTMLCanvasElement.prototype
  vi.spyOn(proto, 'toDataURL').mockImplementation(function (
    this: HTMLCanvasElement,
    type = 'image/png'
  ) {
    syncEncodes.push({ w: this.width, type })
    return `data:${actual(type)};base64,eA==`
  })
  vi.spyOn(proto, 'toBlob').mockImplementation(
    (done: BlobCallback, type = 'image/png', quality?: number) => {
      blobs.push({ type, quality })
      const blob =
        opts.blob === false ? null : new Blob(['x'], { type: actual(type) })
      setTimeout(() => done(blob))
    }
  )
  const alpha = opts.alpha ?? 255
  vi.spyOn(proto, 'getContext').mockImplementation(
    () =>
      ({
        drawImage() {},
        getImageData: (_x: number, _y: number, w: number, h: number) => {
          const data = new Uint8ClampedArray(w * h * 4).fill(255)
          data[data.length - 1] = alpha
          return { data }
        },
      }) as unknown as CanvasRenderingContext2D
  )
  return { syncEncodes, blobs }
}

/** A photo too large to send as it is, so it is drawn and encoded. */
function bigPicture(type: string) {
  vi.stubGlobal('createImageBitmap', async () => ({
    width: 4032,
    height: 3024,
    close() {},
  }))
  return new File(['x'], `p.${type.split('/')[1]}`, { type })
}

/** A fresh module: whether WebP encodes is remembered per page. */
async function freshReadImage() {
  vi.resetModules()
  return (await import('../images')).readImage
}

describe('readImage encoding', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('where WebP encodes, sends WebP 0.9 encoded off the main thread', async () => {
    const canvas = fakeCanvas({ webp: true })
    const readImage = await freshReadImage()
    const img = await readImage(bigPicture('image/jpeg'))
    expect(img.url.startsWith('data:image/webp;')).toBe(true)
    expect(canvas.blobs).toEqual([{ type: 'image/webp', quality: 0.9 }])
    // only the 1 × 1 probe is encoded synchronously
    expect(canvas.syncEncodes.every((e) => e.w === 1)).toBe(true)
    expect([img.w, img.h]).toEqual([1568, 1176])
  })

  test('where WebP comes back as PNG (Safari), a photo goes as JPEG 0.85', async () => {
    const canvas = fakeCanvas({ webp: false })
    const readImage = await freshReadImage()
    const img = await readImage(bigPicture('image/jpeg'))
    expect(img.url.startsWith('data:image/jpeg;')).toBe(true)
    expect(canvas.blobs).toEqual([{ type: 'image/jpeg', quality: 0.85 }])
  })

  test('without WebP, an opaque PNG goes as JPEG too', async () => {
    fakeCanvas({ webp: false, alpha: 255 })
    const readImage = await freshReadImage()
    const img = await readImage(bigPicture('image/png'))
    expect(img.url.startsWith('data:image/jpeg;')).toBe(true)
  })

  test('without WebP, a PNG with transparent pixels stays PNG', async () => {
    fakeCanvas({ webp: false, alpha: 0 })
    const readImage = await freshReadImage()
    const img = await readImage(bigPicture('image/png'))
    expect(img.url.startsWith('data:image/png;')).toBe(true)
  })

  test('a WebP request that comes back as another type falls back to JPEG', async () => {
    const canvas = fakeCanvas({ webp: false })
    // the probe says yes, the real encode says no
    vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockImplementationOnce(
      () => 'data:image/webp;base64,eA=='
    )
    const readImage = await freshReadImage()
    const img = await readImage(bigPicture('image/jpeg'))
    expect(img.url.startsWith('data:image/jpeg;')).toBe(true)
    expect(canvas.blobs.map((b) => b.type)).toEqual([
      'image/webp',
      'image/jpeg',
    ])
  })

  test('when toBlob gives nothing, encodes with toDataURL as before', async () => {
    const canvas = fakeCanvas({ webp: true, blob: false })
    const readImage = await freshReadImage()
    const img = await readImage(bigPicture('image/jpeg'))
    expect(img.url.startsWith('data:image/webp;')).toBe(true)
    expect(canvas.syncEncodes.at(-1)).toEqual({ w: 1568, type: 'image/webp' })
  })
})
