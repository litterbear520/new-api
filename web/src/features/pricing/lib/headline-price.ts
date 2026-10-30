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
import type { PricingModel } from '../types'
import { getDynamicPricingSummary } from './dynamic-price'
import { isTokenBasedModel } from './model-helpers'
import { calculateTokenPrice } from './price'

export type HeadlinePrice = {
  /** USD per 1M input tokens, base group */
  input: number
  /** USD per 1M output tokens, base group */
  output: number
}

/**
 * The input and output token prices a short summary shows: the plain ratio
 * price, or the first tier of a tiered expression. A side is undefined when
 * the model does not price it; null when a model is billed some other way
 * (per request, per task, a special expression).
 */
export function headlineTokenPrices(
  model: PricingModel,
  now?: Date
): Partial<HeadlinePrice> | null {
  const summary = getDynamicPricingSummary(model, {
    tokenUnit: 'M',
    groupRatioMultiplier: 1,
    now,
  })
  if (summary) {
    if (summary.isSpecialExpression || summary.isTaskUsage) return null
    const value = (field: string) =>
      summary.primaryEntries.find(
        (entry) => entry.field === field && entry.unit === 'token'
      )?.value
    return { input: value('inputPrice'), output: value('outputPrice') }
  }
  if (!isTokenBasedModel(model)) return null
  return {
    input: calculateTokenPrice(model, 'input', 1),
    output: calculateTokenPrice(model, 'output', 1),
  }
}

/** Both headline prices, or null when either is missing */
export function headlinePrice(
  model: PricingModel,
  now?: Date
): HeadlinePrice | null {
  const prices = headlineTokenPrices(model, now)
  const input = prices?.input
  const output = prices?.output
  return input !== undefined &&
    output !== undefined &&
    Number.isFinite(input) &&
    Number.isFinite(output)
    ? { input, output }
    : null
}
