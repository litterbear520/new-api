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

import { toIntlLocale } from '@/i18n/languages'

import { DEFAULT_CHIPS } from '../../constants'
import {
  amountChips,
  effectivePrice,
  parseRules,
  quote,
  tierFor,
  topupRequestAmount,
  yuan,
} from '../rules'

const TIERS = [
  { min: 50, rate: 0.05 },
  { min: 100, rate: 0.1 },
  { min: 300, rate: 0.15 },
  { min: 500, rate: 0.2 },
]

describe('parseRules', () => {
  test('reads pay-bridge rules and sorts the tiers', () => {
    const rules = parseRules({
      tiers: [
        { min: 500, rate: 0.2 },
        { min: 50, rate: 0.05 },
      ],
      bonus_days: 90,
      bonus_plan_id: 3,
      gift_plan_id: 4,
    })
    expect(rules).toEqual({
      tiers: [
        { min: 50, rate: 0.05 },
        { min: 500, rate: 0.2 },
      ],
      first: null,
      invite: null,
      bonusDays: 90,
      bonusPlanId: 3,
      giftPlanId: 4,
    })
  })

  test('reads the invite rewards, and drops nonsense', () => {
    expect(parseRules({ invite: { inviter: 5, invitee: 2.5 } }).invite).toEqual(
      { inviter: 5, invitee: 2.5 }
    )
    for (const invite of [
      null,
      { inviter: 0, invitee: 0 },
      { inviter: -5, invitee: 5 },
      { inviter: '5' },
    ]) {
      expect(parseRules({ invite }).invite).toBeNull()
    }
  })

  test('drops anything that could promise a bonus by mistake', () => {
    const rules = parseRules({
      tiers: [
        { min: 50, rate: 5 },
        { min: -1, rate: 0.1 },
        { min: '100', rate: 0.1 },
        null,
      ],
      bonus_plan_id: 0,
    })
    expect(rules.tiers).toEqual([])
    expect(rules.bonusPlanId).toBeNull()
    expect(parseRules('nope').tiers).toEqual([])
    expect(parseRules(null).giftPlanId).toBeNull()
  })
})

describe('starter pack', () => {
  const FIRST = { pay: 6, bonus: 40, days: 30, planId: 3 }

  test('is read from pay-bridge and dropped when malformed', () => {
    expect(
      parseRules({
        tiers: [],
        first: { pay: 6, bonus: 40, days: 30, plan_id: 3 },
      }).first
    ).toEqual(FIRST)
    expect(
      parseRules({ first: { pay: 0, bonus: 40, days: 30 } }).first
    ).toBeNull()
    expect(
      parseRules({ first: { pay: 6, bonus: 40, days: 0 } }).first
    ).toBeNull()
    // the old 首充 shape (a rate with a cap) is not a gift
    expect(
      parseRules({ first: { rate: 0.5, max: 50, days: 30 } }).first
    ).toBeNull()
    expect(parseRules({}).first).toBeNull()
  })

  test('only the gift price earns the gift bonus, never with a tier', () => {
    expect(quote(6, 0.1, TIERS, FIRST)).toEqual({
      amount: 60,
      pay: 6,
      bonus: 40,
      rate: 40 / 60,
      source: 'first',
    })
    expect(quote(10, 0.1, TIERS, FIRST)).toMatchObject({
      bonus: 0,
      source: null,
    })
    expect(quote(100, 0.1, TIERS, FIRST)).toMatchObject({
      bonus: 100,
      source: 'tier',
    })
    expect(quote(6, 0.1, TIERS).source).toBeNull()
  })
})

describe('tiers and quotes', () => {
  test('a payment takes the highest tier it reaches, whole', () => {
    expect(tierFor(TIERS, 49.99)).toBeNull()
    expect(tierFor(TIERS, 50)?.rate).toBe(0.05)
    expect(tierFor(TIERS, 299)?.rate).toBe(0.1)
    expect(tierFor(TIERS, 5000)?.rate).toBe(0.2)
  })

  test('buttons are the smallest amount plus one per tier', () => {
    expect(amountChips(TIERS)).toEqual([10, 50, 100, 300, 500])
    expect(amountChips([])).toEqual(DEFAULT_CHIPS)
  })

  test('at ¥1 = $10, ¥100 buys $1,000 plus $100', () => {
    expect(quote(100, 0.1, TIERS)).toEqual({
      amount: 1000,
      pay: 100,
      bonus: 100,
      rate: 0.1,
      source: 'tier',
    })
    expect(quote(10, 0.1, TIERS)).toEqual({
      amount: 100,
      pay: 10,
      bonus: 0,
      rate: 0,
      source: null,
    })
    expect(quote(150, 0.1, TIERS).bonus).toBe(150)
  })

  test('a price that does not divide evenly charges what New API will', () => {
    const q = quote(100, 0.3, TIERS)
    expect(q.amount).toBe(333)
    expect(q.pay).toBe(99.9)
    // 99.90 is below the ¥100 tier: 5% of $333
    expect(q).toMatchObject({ bonus: 16.65, source: 'tier' })
  })

  test('nothing to pay gives an empty quote', () => {
    expect(quote(0, 0.1, TIERS).amount).toBe(0)
    expect(quote(100, 0, TIERS).amount).toBe(0)
  })

  test('the tier follows what New API charges, not the button', () => {
    // A top-up group ratio of 0.8 makes ¥100 of credit cost ¥80
    expect(quote(100, 0.1, TIERS, null, 80)).toEqual({
      amount: 1000,
      pay: 80,
      bonus: 50,
      rate: 0.05,
      source: 'tier',
    })
  })

  test('the starter bonus needs New API to charge exactly its price', () => {
    const first = { pay: 6, bonus: 40, days: 30, planId: 3 }
    expect(quote(6, 0.1, TIERS, first, 6).source).toBe('first')
    expect(quote(6, 0.1, TIERS, first, 4.8).source).toBeNull()
  })

  test('yuan drops trailing zeros', () => {
    expect(yuan(9.9, 'en')).toBe('¥9.9')
    expect(yuan(100, 'en')).toBe('¥100')
    expect(yuan(99.999, 'en')).toBe('¥100')
  })

  test.each([
    ['en', /^¥12,345\.6$/],
    ['zhCN', /^¥12,345\.6$/],
    ['zhTW', /^¥12,345\.6$/],
    ['fr', /^12\s345,6\s¥$/],
    ['ja', /^[¥￥]12,345\.6$/],
    ['ru', /^12\s345,6\s¥$/],
    ['vi', /^12\.345,6\s¥$/],
    ['not a language', /^¥12,345\.6$/],
  ])('yuan groups thousands in %s', (language, expected) => {
    // An unknown language has no Intl tag, so the caller's fallback applies
    expect(yuan(12345.6, toIntlLocale(language) ?? 'en')).toMatch(expected)
  })
})

describe('top-up request amount', () => {
  test('New API takes whole dollars when quota shows as money', () => {
    for (const quotaDisplayType of ['USD', 'CNY', 'CUSTOM'] as const) {
      expect(
        topupRequestAmount(100, { quotaDisplayType, quotaPerUnit: 500000 })
      ).toBe(100)
    }
  })

  test('New API takes tokens when quota shows as tokens', () => {
    expect(
      topupRequestAmount(100, {
        quotaDisplayType: 'TOKENS',
        quotaPerUnit: 500000,
      })
    ).toBe(50_000_000)
  })
})

describe('effective price', () => {
  test('is the price until New API has answered', () => {
    expect(effectivePrice(0.1, [{ amount: 1000, money: null }])).toBe(0.1)
  })

  test('follows a top-up group ratio New API applies to every amount', () => {
    expect(
      effectivePrice(0.1, [
        { amount: 100, money: 8 },
        { amount: 1000, money: 80 },
      ])
    ).toBeCloseTo(0.08)
  })

  test('is unknown when amounts are discounted unevenly', () => {
    expect(
      effectivePrice(0.1, [
        { amount: 100, money: 10 },
        { amount: 1000, money: 90 },
      ])
    ).toBeNull()
  })
})
