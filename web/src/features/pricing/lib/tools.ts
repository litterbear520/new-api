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
import { IMAGE_MODEL } from '@/features/bear-chat/constants'

import type { PricingModel } from '../types'

/** A place where a model is used: a coding tool (docs guide) or the drawing page */
export type ModelTool = {
  id: 'claude-code' | 'codex' | 'gemini-cli' | 'draw'
  label: string
  /** Docs guide, or the in-app page for `draw` */
  href: string
}

const CLAUDE_CODE: ModelTool = {
  id: 'claude-code',
  label: 'Claude Code',
  href: '/docs/tools/claude-code/',
}
const CODEX: ModelTool = {
  id: 'codex',
  label: 'Codex',
  href: '/docs/tools/codex/',
}
const GEMINI_CLI: ModelTool = {
  id: 'gemini-cli',
  label: 'Gemini CLI',
  href: '/docs/tools/gemini-cli/',
}
const DRAW: ModelTool = { id: 'draw', label: 'Draw pictures', href: '/draw' }

export function isImageModel(model: PricingModel): boolean {
  return (
    IMAGE_MODEL.test(model.model_name) ||
    (model.supported_endpoint_types ?? []).includes('image-generation')
  )
}

/** Tools a model is made for, from its family; image models go to drawing */
export function getModelTools(model: PricingModel): ModelTool[] {
  if (isImageModel(model)) return [DRAW]
  const name = model.model_name.toLowerCase()
  const vendor = (model.vendor_name ?? '').toLowerCase()
  if (name.startsWith('claude') || vendor.includes('anthropic')) {
    return [CLAUDE_CODE]
  }
  if (/^(gpt|o\d|codex)/.test(name) || vendor.includes('openai')) {
    return [CODEX]
  }
  if (name.startsWith('gemini') || vendor.includes('google')) {
    return [GEMINI_CLI]
  }
  return []
}

/**
 * What a USD list price really costs in yuan: the site sells $1 of credit
 * for `priceRate` yuan (status.price), so ¥ = $ × priceRate. Payments are in
 * yuan whatever currency the console shows, so this is not
 * `formatLocalCurrencyAmount` (it would print the display currency's symbol).
 */
export function formatYuan(
  usd: number,
  priceRate: number,
  locale?: string
): string | null {
  if (!Number.isFinite(usd) || usd < 0 || !(priceRate > 0)) return null
  const format = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })
  const yuan = usd * priceRate
  if (yuan > 0 && yuan < 0.0001) return `<${format.format(0.0001)}`
  return format.format(yuan)
}
