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
import { describe, expect, it } from 'vitest'

import { MODEL_META } from '@/features/draw/constants'

import { DEFAULT_IMAGE_MODEL, IMAGE_MODEL_META } from '../constants'

describe('image model names', () => {
  it('tells every model apart in the composer chip', () => {
    const shorts = Object.values(IMAGE_MODEL_META).map((m) => m.short)
    expect(new Set(shorts).size).toBe(shorts.length)
  })

  it('tells every model apart in the classic menu', () => {
    const names = Object.values(MODEL_META).map((m) => m.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('keeps the recommended tag on the default model', () => {
    expect(IMAGE_MODEL_META[DEFAULT_IMAGE_MODEL]?.tag).toBe('recommended')
  })
})
