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
import { evaluateBillingExpression } from '@/features/pricing/lib/billing-expression/runtime'
import {
  TOKEN_VARIABLES,
  type TokenVariable,
} from '@/features/pricing/lib/billing-expression/types'
import type { PricingModel } from '@/features/pricing/types'

import type { ChatUsage } from '../types'

type Tokens = Partial<Record<TokenVariable, number>>

/** Every variable an expression names must have a value; unused ones are 0. */
function zeroTokens(): Record<TokenVariable, number> {
  return Object.fromEntries(TOKEN_VARIABLES.map((v) => [v, 0])) as Record<
    TokenVariable,
    number
  >
}

/**
 * USD for some tokens, billed the way New API bills chat: a tiered
 * expression (USD per 1M tokens), a fixed price per call, or the classic
 * ratio mode (ratio 1 = $2 per 1M tokens, cache reads at `cache_ratio`).
 * Returns null when the model has no usable price.
 */
export function priceFor(
  model: PricingModel | undefined,
  tokens: { p: number; c: number; cr: number },
  groupRatio: number
): number | null {
  if (!model) return null
  if (model.billing_mode === 'tiered_expr' && model.billing_expr) {
    const vars: Tokens = { ...tokens, len: tokens.p + tokens.cr }
    const result = evaluateBillingExpression(model.billing_expr, {
      tokens: { ...zeroTokens(), ...vars },
    })
    if (result.status !== 'success') return null
    const usd =
      result.billingUnit === 'request' ? result.cost : result.cost / 1e6
    return usd * groupRatio
  }
  if (model.quota_type === 1) return (model.model_price ?? 0) * groupRatio
  const cacheRatio = model.cache_ratio ?? 1
  const weighted =
    tokens.p + tokens.cr * cacheRatio + tokens.c * model.completion_ratio
  return (weighted * model.model_ratio * 2 * groupRatio) / 1e6
}

/** Estimated cost of one reply from the usage it returned. */
export function costOfUsage(
  model: PricingModel | undefined,
  usage: ChatUsage,
  groupRatio: number
): number | null {
  const cached = Math.min(usage.cached ?? 0, usage.prompt)
  return priceFor(
    model,
    { p: usage.prompt - cached, c: usage.completion, cr: cached },
    groupRatio
  )
}

export type ModelPrice =
  | { kind: 'tokens'; input: number; output: number }
  | { kind: 'call'; perCall: number }

/** Price per 1M input / output tokens (or per call), for the model menu. */
export function modelPrice(
  model: PricingModel | undefined,
  groupRatio: number
): ModelPrice | null {
  if (!model) return null
  if (model.billing_mode === 'tiered_expr' && model.billing_expr) {
    const flat = evaluateBillingExpression(model.billing_expr, {
      tokens: zeroTokens(),
    })
    if (flat.status === 'success' && flat.billingUnit === 'request') {
      return { kind: 'call', perCall: flat.cost * groupRatio }
    }
  } else if (model.quota_type === 1) {
    return { kind: 'call', perCall: (model.model_price ?? 0) * groupRatio }
  }
  // 1K tokens keeps tiered models in their first (short-context) tier
  const input = priceFor(model, { p: 1000, c: 0, cr: 0 }, groupRatio)
  const output = priceFor(model, { p: 0, c: 1000, cr: 0 }, groupRatio)
  if (input == null || output == null) return null
  return { kind: 'tokens', input: input * 1000, output: output * 1000 }
}
