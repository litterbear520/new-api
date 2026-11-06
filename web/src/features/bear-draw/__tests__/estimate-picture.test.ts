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

import type { PricingModel } from '@/features/pricing/types'

import { estimatePicture, setPicturesEnv } from '../lib/pictures'

const MODEL = 'gpt-image-2.6-sunburst'
const price = {
  id: 1,
  model_name: MODEL,
  quota_type: 0,
  model_ratio: 37.5,
  completion_ratio: 2,
  enable_groups: ['default'],
  billing_mode: 'tiered_expr',
  billing_expr:
    'tier("standard", p * 5 + cr * 1.25 + img * 8 + img_cr * 2 + c * 30)',
} satisfies PricingModel

setPicturesEnv({
  uid: 1,
  imageModels: [MODEL],
  prices: new Map([[MODEL, price]]),
  groupRatio: 1,
})

describe('estimatePicture', () => {
  test('a plain picture: 300 text in, 700 out', () => {
    const usd = estimatePicture(MODEL, {
      edit: false,
      refs: 0,
      transparent: false,
    })
    expect(usd).toBeCloseTo(0.0225, 6)
  })

  test('an edit counts its input picture and the larger edit output', () => {
    // 300 * 5 + 1521 * 8 + 1372 * 30 per 1M tokens
    const usd = estimatePicture(MODEL, {
      edit: true,
      refs: 1,
      transparent: false,
    })
    expect(usd).toBeCloseTo(0.054828, 6)
  })

  test('a transparent picture keeps the transparent output, also when editing', () => {
    const plain = estimatePicture(MODEL, {
      edit: false,
      refs: 0,
      transparent: true,
    })
    const edit = estimatePicture(MODEL, {
      edit: true,
      refs: 1,
      transparent: true,
    })
    expect(plain).toBeCloseTo(0.06324, 6)
    expect(edit).toBeCloseTo(0.06324 + 0.012168, 6)
  })
})
