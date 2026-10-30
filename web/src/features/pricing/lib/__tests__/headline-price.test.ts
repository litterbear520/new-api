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

import type { PricingModel } from '../../types'
import { headlinePrice, headlineTokenPrices } from '../headline-price'

function model(overrides: Partial<PricingModel>): PricingModel {
  return {
    id: 1,
    model_name: 'example',
    quota_type: 0,
    model_ratio: 2.5,
    completion_ratio: 5,
    enable_groups: ['default'],
    ...overrides,
  }
}

describe('headline prices', () => {
  it('reads input and output per 1M tokens from the ratios', () => {
    expect(headlineTokenPrices(model({}))).toEqual({ input: 5, output: 25 })
    expect(headlinePrice(model({}))).toEqual({ input: 5, output: 25 })
  })

  it('reads the first tier of a tiered expression', () => {
    const tiered = model({
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", p * 3 + c * 15)',
    })
    expect(headlineTokenPrices(tiered)).toEqual({ input: 3, output: 15 })
    expect(headlinePrice(tiered)).toEqual({ input: 3, output: 15 })
  })

  it('keeps a lone input price for the details strip, but gives no pair', () => {
    const embedding = model({
      billing_mode: 'tiered_expr',
      billing_expr: 'tier("base", p * 0.13)',
    })
    expect(headlineTokenPrices(embedding)).toEqual({
      input: 0.13,
      output: undefined,
    })
    expect(headlinePrice(embedding)).toBeNull()
  })

  it('gives nothing for models billed per request', () => {
    const perCall = model({ quota_type: 1, model_price: 0.04 })
    expect(headlineTokenPrices(perCall)).toBeNull()
    expect(headlinePrice(perCall)).toBeNull()
  })
})
