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

import { costOfUsage, modelPrice } from '../cost'

// 小熊API's gpt-6.1-sol price (USD per 1M tokens, 272K tier).
const tiered = {
  id: 1,
  model_name: 'gpt-6.1-sol',
  quota_type: 0,
  model_ratio: 1,
  completion_ratio: 1,
  enable_groups: ['default'],
  billing_mode: 'tiered_expr',
  billing_expr:
    '((len <= 272000)) ? (tier("standard", p * 2 + c * 10 + cr * 0.1 + cc * 2.5)) : (tier("long_context", p * 4 + c * 15 + cr * 0.2 + cc * 5))',
} satisfies PricingModel

// claude-sonnet-4-6 in ratio mode: ratio 1.5 = $3 / 1M input, completion ×5.
const ratio = {
  id: 2,
  model_name: 'claude-sonnet-4-6',
  quota_type: 0,
  model_ratio: 1.5,
  completion_ratio: 5,
  cache_ratio: 0.1,
  enable_groups: ['default'],
} satisfies PricingModel

describe('costOfUsage', () => {
  test('a tiered model bills cached prompt tokens at the cache price', () => {
    const usage = { prompt: 1000, completion: 500, total: 1500, cached: 600 }
    // 400 × $2 + 600 × $0.1 + 500 × $10, per 1M
    expect(costOfUsage(tiered, usage, 1)).toBeCloseTo(0.00586, 8)
  })

  test('a ratio model uses its completion and cache ratios', () => {
    const usage = { prompt: 1000, completion: 100, total: 1100, cached: 500 }
    // (500 + 500 × 0.1 + 100 × 5) × 1.5 × 2 / 1M
    expect(costOfUsage(ratio, usage, 1)).toBeCloseTo(0.00315, 8)
  })

  test('without a price there is no estimate', () => {
    expect(
      costOfUsage(undefined, { prompt: 1, completion: 1, total: 2 }, 1)
    ).toBeNull()
  })
})

describe('modelPrice', () => {
  test('shows the first tier of a tiered model per 1M tokens', () => {
    const price = modelPrice(tiered, 1)
    expect(price?.kind).toBe('tokens')
    if (price?.kind !== 'tokens') return
    expect(price.input).toBeCloseTo(2, 9)
    expect(price.output).toBeCloseTo(10, 9)
  })

  test('applies the group ratio to ratio-mode prices', () => {
    const price = modelPrice(ratio, 2)
    if (price?.kind !== 'tokens') throw new Error('expected a token price')
    expect(price.input).toBeCloseTo(6, 9)
    expect(price.output).toBeCloseTo(30, 9)
  })
})
