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
import { quote, type PayRules } from '@/features/bear-wallet/lib/rules'
import { formatSharePercent, isDiscounted } from '@/lib/discount'

/** ¥1 buys `credit` dollars; `share` = what that costs against the official price */
export interface RateOffer {
  kind: 'rate'
  credit: number
  share: number
}

/** 新人礼包 as it is charged: pay `pay` yuan, get `credit` + `bonus` dollars */
export interface StarterOffer {
  kind: 'starter'
  pay: number
  credit: number
  bonus: number
  days: number
  planId: number | null
}

export interface TierRow {
  pay: number
  credit: number
  bonus: number
  rate: number
}

/** 充值赠送: one row per tier, from the tier's smallest payment */
export interface TiersOffer {
  kind: 'tiers'
  rows: TierRow[]
  days: number
}

/** 邀请奖励 in dollars */
export interface InviteOffer {
  kind: 'invite'
  inviter: number
  invitee: number
}

export type Offer = RateOffer | StarterOffer | TiersOffer | InviteOffer

const positive = (value: unknown): number | null => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * The offers running now, in page order. Each comes from the same numbers the
 * checkout uses (New API's Price and pay-bridge's rules); an offer whose
 * numbers are missing is left out rather than guessed.
 */
export function buildOffers(input: {
  /** Yuan per dollar of credit (New API's Price) */
  price: unknown
  /** Yuan per US dollar */
  usdRate: unknown
  rules: PayRules
}): Offer[] {
  const price = positive(input.price)
  const usdRate = positive(input.usdRate)
  const { rules } = input
  const offers: Offer[] = []

  if (price && usdRate && isDiscounted(price, usdRate)) {
    offers.push({ kind: 'rate', credit: 1 / price, share: price / usdRate })
  }

  if (price && rules.first) {
    const q = quote(rules.first.pay, price, rules.tiers, rules.first)
    if (q.source === 'first') {
      offers.push({
        kind: 'starter',
        pay: q.pay,
        credit: q.amount,
        bonus: q.bonus,
        days: rules.first.days,
        planId: rules.first.planId,
      })
    }
  }

  if (price && rules.tiers.length) {
    const rows = rules.tiers.flatMap((tier) => {
      const q = quote(tier.min, price, rules.tiers)
      return q.source === 'tier'
        ? [{ pay: q.pay, credit: q.amount, bonus: q.bonus, rate: tier.rate }]
        : []
    })
    if (rows.length) offers.push({ kind: 'tiers', rows, days: rules.bonusDays })
  }

  if (rules.invite) {
    offers.push({ kind: 'invite', ...rules.invite })
  }

  return offers
}

/** A share as a percent with one decimal, two under 1%: 0.0143 → "1.4%" */
export function sharePercent(share: number): string {
  return formatSharePercent(share * 100)
}
