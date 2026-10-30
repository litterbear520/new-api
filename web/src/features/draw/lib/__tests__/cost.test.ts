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

import { costFromUsage, estimateCost } from '../cost'

// The built-in OpenAI image price New API serves for gpt-image-* (per 1M tokens).
const imageModel = {
  id: 1,
  model_name: 'gpt-image-2',
  quota_type: 0,
  model_ratio: 37.5,
  completion_ratio: 2,
  enable_groups: ['default'],
  billing_mode: 'tiered_expr',
  billing_expr:
    'tier("standard", p * 5 + cr * 1.25 + img * 8 + img_cr * 2 + c * 30)',
} satisfies PricingModel

describe('costFromUsage', () => {
  test('a generation is billed like the gateway billed it (34 in, 301 out = $0.0092)', () => {
    const usage = {
      input_tokens: 34,
      output_tokens: 301,
      input_tokens_details: { text_tokens: 34, image_tokens: 0 },
    }
    expect(costFromUsage(imageModel, usage, 1)).toBeCloseTo(0.0092, 6)
  })

  test('an edit counts its input pictures at the image rate', () => {
    const usage = {
      input_tokens: 3145,
      output_tokens: 915,
      input_tokens_details: { text_tokens: 103, image_tokens: 3042 },
    }
    expect(costFromUsage(imageModel, usage, 1)).toBeCloseTo(0.052301, 6)
  })

  test('the group ratio scales the cost', () => {
    const usage = { input_tokens: 34, output_tokens: 301 }
    expect(costFromUsage(imageModel, usage, 2)).toBeCloseTo(0.0184, 6)
  })

  test('missing usage or price gives no cost', () => {
    expect(costFromUsage(imageModel, undefined, 1)).toBeNull()
    expect(costFromUsage(undefined, { output_tokens: 1 }, 1)).toBeNull()
  })
})

describe('estimateCost', () => {
  test('attached pictures add their input cost to the picture itself', () => {
    const plain = estimateCost(imageModel, 1, {
      ratio: 'square',
      clear: false,
      images: 0,
      edit: false,
    })
    const withTwo = estimateCost(imageModel, 1, {
      ratio: 'square',
      clear: false,
      images: 2,
      edit: false,
    })
    expect(plain?.images).toBe(0)
    expect(withTwo?.perImage).toBeCloseTo(0.012168, 6)
    expect(withTwo?.total).toBeCloseTo((plain?.total ?? 0) + 2 * 0.012168, 6)
  })

  test('a transparent background costs more than any plain ratio', () => {
    const clear = estimateCost(imageModel, 1, {
      ratio: 'auto',
      clear: true,
      images: 0,
      edit: false,
    })
    const square = estimateCost(imageModel, 1, {
      ratio: 'square',
      clear: false,
      images: 0,
      edit: false,
    })
    expect(clear?.out).toBeGreaterThan(square?.out ?? Infinity)
  })
})
