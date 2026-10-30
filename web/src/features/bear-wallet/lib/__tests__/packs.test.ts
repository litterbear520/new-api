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

import type {
  SubscriptionPlan,
  UserSubscription,
} from '@/features/subscriptions/types'

import {
  activePacks,
  giftOffer,
  packsLeft,
  planDays,
  quotaToUsd,
  starterOpen,
} from '../packs'

const NOW = 1_800_000_000
const DOLLAR = 500000

const sub = (over: Partial<UserSubscription>): UserSubscription => ({
  id: 1,
  user_id: 7,
  plan_id: 3,
  status: 'active',
  start_time: NOW - 86400,
  end_time: NOW + 86400,
  amount_total: 100 * DOLLAR,
  amount_used: 0,
  ...over,
})

const plan = (over: Partial<SubscriptionPlan>): SubscriptionPlan => ({
  id: 4,
  title: '新人礼包',
  price_amount: 9.9,
  currency: 'USD',
  duration_unit: 'day',
  duration_value: 30,
  quota_reset_period: 'never',
  enabled: true,
  sort_order: 0,
  allow_balance_pay: false,
  allow_wallet_overflow: true,
  max_purchase_per_user: 1,
  total_amount: 200 * DOLLAR,
  ...over,
})

const IDS = {
  bonusPlanId: 3,
  giftPlanId: 4,
  first: { pay: 6, bonus: 40, days: 30, planId: 8 },
}

describe('activePacks', () => {
  test('keeps packs with credit left, soonest to expire first', () => {
    const packs = activePacks(
      [
        sub({ id: 1, end_time: NOW + 90 * 86400 }),
        sub({
          id: 2,
          plan_id: 4,
          end_time: NOW + 86400,
          amount_used: 50 * DOLLAR,
        }),
        sub({ id: 3, status: 'expired' }),
        sub({ id: 4, end_time: NOW - 1 }),
        sub({ id: 5, amount_used: 100 * DOLLAR }),
        sub({ id: 6, plan_id: 9, amount_total: 0 }),
        sub({ id: 7, plan_id: 8, end_time: NOW + 20 * 86400 }),
      ],
      IDS,
      NOW
    )
    expect(packs.map((pack) => [pack.id, pack.kind, pack.left])).toEqual([
      [2, 'gift', 50 * DOLLAR],
      [7, 'first', 100 * DOLLAR],
      [1, 'bonus', 100 * DOLLAR],
    ])
    expect(packsLeft(packs)).toBe(250 * DOLLAR)
  })
})

describe('giftOffer', () => {
  test('offers the gift until the user has bought it', () => {
    expect(giftOffer([plan({})], [], 4)?.id).toBe(4)
    expect(
      giftOffer([plan({})], [sub({ plan_id: 4, status: 'expired' })], 4)
    ).toBeNull()
    expect(giftOffer([plan({ enabled: false })], [], 4)).toBeNull()
    expect(giftOffer([plan({})], [], null)).toBeNull()
  })

  test('the starter pack is once per account', () => {
    const first = { pay: 6, bonus: 40, days: 30, planId: 5 }
    expect(starterOpen(first, [])).toBe(true)
    expect(starterOpen(first, [sub({ plan_id: 3 })])).toBe(true)
    expect(starterOpen(first, [sub({ plan_id: 5, status: 'expired' })])).toBe(
      false
    )
    expect(starterOpen(first, undefined)).toBe(false)
    expect(starterOpen({ ...first, planId: null }, [])).toBe(false)
    expect(starterOpen(null, [])).toBe(false)
  })

  test('plan length in days', () => {
    expect(planDays(plan({}))).toBe(30)
    expect(
      planDays(plan({ duration_unit: 'custom', custom_seconds: 90 * 86400 }))
    ).toBe(90)
    expect(
      planDays(plan({ duration_unit: 'month', duration_value: 1 }))
    ).toBeNull()
  })

  test('quota to dollars', () => {
    expect(quotaToUsd(200 * DOLLAR, DOLLAR)).toBe(200)
    expect(quotaToUsd(DOLLAR / 3, DOLLAR)).toBe(0.33)
  })
})
