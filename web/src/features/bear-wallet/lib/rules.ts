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
import type { CurrencyConfig } from '@/stores/system-config-store'

import { BASE_CHIP, DEFAULT_CHIPS } from '../constants'

/** From `min` yuan in one payment, `rate` of the amount is added as bonus */
export interface BonusTier {
  min: number
  rate: number
}

/** 新人礼包, once per account: a top-up of exactly `pay` yuan also gets `bonus` dollars */
export interface FirstRule {
  pay: number
  bonus: number
  days: number
  planId: number | null
}

/** 邀请奖励 in dollars: what the inviter and the friend each get on sign-up */
export interface InviteRule {
  inviter: number
  invitee: number
}

export interface PayRules {
  tiers: BonusTier[]
  /** 新人礼包, or null when pay-bridge does not give one */
  first: FirstRule | null
  /** New API's invite rewards as pay-bridge repeats them, or null if unknown */
  invite: InviteRule | null
  /** How long a bonus pack lasts */
  bonusDays: number
  bonusPlanId: number | null
  giftPlanId: number | null
}

export const NO_RULES: PayRules = {
  tiers: [],
  first: null,
  invite: null,
  bonusDays: 0,
  bonusPlanId: null,
  giftPlanId: null,
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function positiveId(value: unknown): number | null {
  const n = finite(value)
  return n !== null && n > 0 ? n : null
}

/**
 * Reads pay-bridge's /pay/rules leniently: anything malformed counts as no
 * bonus, so the page never promises a bonus that will not be granted.
 */
export function parseRules(raw: unknown): PayRules {
  if (!raw || typeof raw !== 'object') return NO_RULES
  const body = raw as Record<string, unknown>
  const tiers = Array.isArray(body.tiers)
    ? body.tiers
        .flatMap((item) => {
          const tier = (item ?? {}) as Record<string, unknown>
          const min = finite(tier.min)
          const rate = finite(tier.rate)
          if (min === null || rate === null) return []
          if (min <= 0 || rate <= 0 || rate >= 1) return []
          return [{ min, rate }]
        })
        .sort((a, b) => a.min - b.min)
    : []
  return {
    tiers,
    first: parseFirst(body.first),
    invite: parseInvite(body.invite),
    bonusDays: Math.max(0, Math.round(finite(body.bonus_days) ?? 0)),
    bonusPlanId: positiveId(body.bonus_plan_id),
    giftPlanId: positiveId(body.gift_plan_id),
  }
}

function parseFirst(raw: unknown): FirstRule | null {
  if (!raw || typeof raw !== 'object') return null
  const first = raw as Record<string, unknown>
  const pay = finite(first.pay)
  const bonus = finite(first.bonus)
  const days = Math.round(finite(first.days) ?? 0)
  if (pay === null || bonus === null || pay <= 0 || bonus <= 0) return null
  if (days < 1) return null
  return {
    pay,
    bonus,
    days,
    planId: positiveId(first.plan_id),
  }
}

function parseInvite(raw: unknown): InviteRule | null {
  if (!raw || typeof raw !== 'object') return null
  const invite = raw as Record<string, unknown>
  const inviter = finite(invite.inviter) ?? 0
  const invitee = finite(invite.invitee) ?? 0
  if (inviter < 0 || invitee < 0 || inviter + invitee <= 0) return null
  return { inviter, invitee }
}

/** The tier one payment falls in: the highest it reaches, or none */
export function tierFor(tiers: BonusTier[], pay: number): BonusTier | null {
  let hit: BonusTier | null = null
  for (const tier of tiers) {
    if (pay + 1e-9 >= tier.min) hit = tier
  }
  return hit
}

/** The amount buttons: the smallest one, then one per bonus tier */
export function amountChips(tiers: BonusTier[]): number[] {
  if (!tiers.length) return DEFAULT_CHIPS
  const chips = new Set([BASE_CHIP, ...tiers.map((tier) => tier.min)])
  return [...chips].sort((a, b) => a - b)
}

export interface Quote {
  /** Top-up amount sent to New API, in dollars of quota */
  amount: number
  /** What the cashier charges, in yuan */
  pay: number
  /** Bonus on top, in dollars of quota */
  bonus: number
  /** bonus ÷ amount */
  rate: number
  /** Which rule gave the bonus */
  source: 'tier' | 'first' | null
}

const ZERO_QUOTE: Quote = { amount: 0, pay: 0, bonus: 0, rate: 0, source: null }

const cents = (value: number) => Math.round(value * 100) / 100

/**
 * What paying `pay` yuan buys. New API takes a whole number of dollars and
 * charges amount × price (times the user group's top-up ratio and any preset
 * discount, which only New API knows: pass its answer as `charged`).
 * pay-bridge then adds rate × amount by the tier of the charged sum, which
 * is the order's money. On a first top-up (`first` given) that charges
 * exactly the 新人礼包 price, pay-bridge gives the gift's bonus instead when
 * it is larger; the two never add up.
 */
export function quote(
  pay: number,
  price: number,
  tiers: BonusTier[],
  first: FirstRule | null = null,
  charged: number | null = null
): Quote {
  if (!(pay > 0) || !(price > 0)) return ZERO_QUOTE
  const amount = Math.round(pay / price)
  if (amount < 1) return ZERO_QUOTE
  const money = cents(
    charged !== null && charged > 0 ? charged : amount * price
  )
  const tierBonus = cents(amount * (tierFor(tiers, money)?.rate ?? 0))
  const firstBonus =
    first && Math.abs(money - first.pay) < 0.005 ? cents(first.bonus) : 0
  if (firstBonus > tierBonus) {
    return {
      amount,
      pay: money,
      bonus: firstBonus,
      rate: firstBonus / amount,
      source: 'first',
    }
  }
  return {
    amount,
    pay: money,
    bonus: tierBonus,
    rate: tierBonus / amount,
    source: tierBonus > 0 ? 'tier' : null,
  }
}

/**
 * The `amount` New API's top-up endpoints take for whole dollars of quota:
 * dollars, or tokens when the site shows quota as tokens (getPayMoney and
 * getMinTopup in controller/topup.go divide by QuotaPerUnit then).
 */
export function topupRequestAmount(
  dollars: number,
  currency: Pick<CurrencyConfig, 'quotaDisplayType' | 'quotaPerUnit'>
): number {
  if (currency.quotaDisplayType !== 'TOKENS') return dollars
  return Math.round(dollars * currency.quotaPerUnit)
}

/**
 * Yuan per dollar as New API really charges: the price times the top-up
 * group ratio, read off its quotes (money ÷ amount). Null when the quotes
 * disagree (preset discounts differ by amount), so no single rate is true.
 */
export function effectivePrice(
  price: number,
  quotes: Array<{ amount: number; money: number | null }>
): number | null {
  const known = quotes.filter(
    (item): item is { amount: number; money: number } =>
      item.money !== null && item.amount > 0
  )
  if (!known.length) return price
  const rates = known.map((item) => item.money / item.amount)
  const high = Math.max(...rates)
  // Quotes are in cents, so allow their rounding.
  if (high - Math.min(...rates) > high * 0.005) return null
  // The largest amount rounds least.
  const largest = known.reduce((a, b) => (b.amount > a.amount ? b : a))
  return largest.money / largest.amount
}

/** Yuan in the reader's locale, at most two decimals: ¥9.9, ¥12,345.6 */
export function yuan(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/** A rate as a whole percent: 0.1 → 10 */
export function percent(rate: number): number {
  return Math.round(rate * 100)
}
