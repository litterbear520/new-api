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

import { NO_RULES, type PayRules } from '@/features/bear-wallet/lib/rules'

import { buildOffers, sharePercent } from '../offers'

const RULES: PayRules = {
  tiers: [
    { min: 10, rate: 0.03 },
    { min: 100, rate: 0.1 },
    { min: 500, rate: 0.2 },
  ],
  first: { pay: 6, bonus: 40, days: 30, planId: 3 },
  invite: { inviter: 5, invitee: 5 },
  bonusDays: 90,
  bonusPlanId: 1,
  giftPlanId: 2,
}

describe('buildOffers', () => {
  test('lists every offer with the numbers the checkout uses', () => {
    const offers = buildOffers({ price: 0.1, usdRate: 7, rules: RULES })
    expect(offers.map((offer) => offer.kind)).toEqual([
      'rate',
      'starter',
      'tiers',
      'invite',
    ])
    const [rate, starter, tiers, invite] = offers
    expect(rate).toMatchObject({ credit: 10 })
    expect(rate.kind === 'rate' && sharePercent(rate.share)).toBe('1.4%')
    expect(starter).toEqual({
      kind: 'starter',
      pay: 6,
      credit: 60,
      bonus: 40,
      days: 30,
      planId: 3,
    })
    expect(tiers).toEqual({
      kind: 'tiers',
      days: 90,
      rows: [
        { pay: 10, credit: 100, bonus: 3, rate: 0.03 },
        { pay: 100, credit: 1000, bonus: 100, rate: 0.1 },
        { pay: 500, credit: 5000, bonus: 1000, rate: 0.2 },
      ],
    })
    expect(invite).toEqual({ kind: 'invite', inviter: 5, invitee: 5 })
  })

  test('leaves out what it cannot read', () => {
    expect(buildOffers({ price: 0.1, usdRate: 7, rules: NO_RULES })).toEqual([
      { kind: 'rate', credit: 10, share: 0.1 / 7 },
    ])
    // no Price: nothing can be turned into dollars, the invite still stands
    expect(
      buildOffers({ price: undefined, usdRate: 7, rules: RULES }).map(
        (offer) => offer.kind
      )
    ).toEqual(['invite'])
  })

  test('shows no rate when it is no cheaper than the exchange rate', () => {
    const kinds = buildOffers({ price: 7, usdRate: 7, rules: NO_RULES })
    expect(kinds).toEqual([])
  })

  test('drops the starter pack when a tier would give more', () => {
    const rules: PayRules = {
      ...RULES,
      first: { pay: 500, bonus: 1, days: 30, planId: 3 },
    }
    const kinds = buildOffers({ price: 0.1, usdRate: 7, rules }).map(
      (offer) => offer.kind
    )
    expect(kinds).not.toContain('starter')
  })
})

describe('sharePercent', () => {
  test('one decimal, two below 1%', () => {
    expect(sharePercent(0.1 / 7)).toBe('1.4%')
    expect(sharePercent(0.05 / 7)).toBe('0.71%')
    expect(sharePercent(0.7 / 7)).toBe('10%')
  })
})
