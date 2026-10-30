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

import { TYPICAL_TOKENS } from '../constants'
import type { DrawRatio, DrawUsage } from '../types'

type TokenCounts = { p: number; img: number; c: number }

/**
 * USD for one request, the way New API bills it: a tiered expression
 * (per 1M tokens), a fixed price per call, or the classic ratio mode
 * (ratio 1 = $2 per 1M tokens). Returns null when the model has no price.
 */
export function priceTokens(
  model: PricingModel | undefined,
  tokens: TokenCounts,
  groupRatio: number
): number | null {
  if (!model) return null
  if (model.billing_mode === 'tiered_expr' && model.billing_expr) {
    // every variable the expression names must have a value; unused ones are 0
    const all = Object.fromEntries(
      TOKEN_VARIABLES.map((v) => [v, 0])
    ) as Record<TokenVariable, number>
    const result = evaluateBillingExpression(model.billing_expr, {
      tokens: { ...all, len: tokens.p + tokens.img, ...tokens },
    })
    if (result.status !== 'success') return null
    const usd =
      result.billingUnit === 'request' ? result.cost : result.cost / 1e6
    return usd * groupRatio
  }
  if (model.quota_type === 1) return (model.model_price ?? 0) * groupRatio
  const weighted = tokens.p + tokens.img + tokens.c * model.completion_ratio
  return (weighted * model.model_ratio * 2 * groupRatio) / 1e6
}

/** What the reply's usage cost; null when the usage or price is missing. */
export function costFromUsage(
  model: PricingModel | undefined,
  usage: DrawUsage | undefined,
  groupRatio: number
): number | null {
  if (!usage) return null
  const images = usage.input_tokens_details?.image_tokens ?? 0
  const text =
    usage.input_tokens_details?.text_tokens ??
    Math.max(0, (usage.input_tokens ?? 0) - images)
  return priceTokens(
    model,
    { p: text, img: images, c: usage.output_tokens ?? 0 },
    groupRatio
  )
}

export type DrawEstimate = {
  /** The picture itself. */
  out: number
  /** Each attached picture. */
  perImage: number
  images: number
  total: number
}

/** Rough cost before sending, from typical token counts. */
export function estimateCost(
  model: PricingModel | undefined,
  groupRatio: number,
  opts: { ratio: DrawRatio; clear: boolean; images: number; edit: boolean }
): DrawEstimate | null {
  let outTokens = TYPICAL_TOKENS.output[opts.ratio]
  if (opts.edit) outTokens = TYPICAL_TOKENS.edit
  if (opts.clear) outTokens = TYPICAL_TOKENS.clear
  const out = priceTokens(
    model,
    { p: TYPICAL_TOKENS.text, img: 0, c: outTokens },
    groupRatio
  )
  if (out == null) return null
  const withOne = priceTokens(
    model,
    { p: 0, img: TYPICAL_TOKENS.inputImage, c: 0 },
    groupRatio
  )
  const perImage = model?.billing_mode === 'tiered_expr' ? (withOne ?? 0) : 0
  return {
    out,
    perImage,
    images: opts.images,
    total: out + perImage * opts.images,
  }
}
