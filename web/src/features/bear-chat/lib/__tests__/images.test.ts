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
