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
import type { SubscriptionPlan } from '@/features/subscriptions/types'
import type { PaymentMethod } from '@/features/wallet/types'

import { quote, type FirstRule, type PayRules, type Quote } from './rules'

/** What the top-up dialog can sell this user */
export interface TopupOffer {
  /** Yuan per dollar of quota (New API's Price) */
  price: number
  rules: PayRules
  gift: SubscriptionPlan | null
  methods: PaymentMethod[]
  /** Smallest top-up New API accepts, in dollars */
  minTopup: number
  isNew: boolean
  /** The user has not had the 新人礼包 yet (once per account) */
  canGetStarter: boolean
  /** "小熊（GitHub 登录）" for the account line, or null */
  account: { name: string; method: string | null } | null
}

/** The 新人礼包 as it would be charged, when this user can take it */
export interface Starter {
  rule: FirstRule
  quote: Quote
  /** What the whole credit costs without the gift, in yuan */
  usual: number
}

/** The 新人礼包 offer for this user, or null */
export function starterOffer(offer: TopupOffer): Starter | null {
  const rule = offer.canGetStarter ? offer.rules.first : null
  if (!rule) return null
  const q = quote(rule.pay, offer.price, offer.rules.tiers, rule)
  if (q.source !== 'first' || q.amount < offer.minTopup) return null
  const usual = Math.round((q.amount + q.bonus) * offer.price * 100) / 100
  return { rule, quote: q, usual }
}
