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
import { expect, test, vi } from 'vitest'

import { chime, ensureAudio } from '../alerts'

test('the first click unlocks sound with silence, never with the chime', async () => {
  let chimes = 0
  URL.createObjectURL = vi.fn((blob: Blob) =>
    blob.size < 5000 ? 'blob:silence' : `blob:chime-${++chimes}`
  )
  const played: string[] = []
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement
  ) {
    played.push(this.src)
    return Promise.resolve()
  })

  ensureAudio()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(played).toEqual(['blob:silence', 'blob:silence'])

  chime(true)
  expect(played.at(-1)).toBe('blob:chime-1')
})
