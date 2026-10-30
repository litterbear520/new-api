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

import { daysCovered, walletGauge } from '../wallet'

describe('walletGauge', () => {
  test('after a top-up it fills by what is left of everything since', () => {
    const gauge = walletGauge({
      balance: 18,
      usedQuota: 500,
      lastTopUpAt: 1792000000,
      spentSinceTopUp: 12,
    })
    expect(gauge).toEqual({ total: 30, left: 0.6, since: 1792000000 })
  })

  test('without a top-up on record it uses the lifetime total', () => {
    const gauge = walletGauge({
      balance: 5,
      usedQuota: 0,
      lastTopUpAt: null,
      spentSinceTopUp: null,
    })
    expect(gauge).toEqual({ total: 5, left: 1, since: null })
  })

  test('an empty account shows an empty gauge', () => {
    const gauge = walletGauge({
      balance: 0,
      usedQuota: 0,
      lastTopUpAt: null,
      spentSinceTopUp: null,
    })
    expect(gauge.left).toBe(0)
  })

  test('a negative balance counts as empty', () => {
    const gauge = walletGauge({
      balance: -3,
      usedQuota: 10,
      lastTopUpAt: 1,
      spentSinceTopUp: 10,
    })
    expect(gauge.left).toBe(0)
    expect(gauge.total).toBe(10)
  })
})

describe('daysCovered', () => {
  test('an amount lasts amount ÷ daily pace days', () => {
    expect(daysCovered(20, 2)).toBe(10)
    expect(daysCovered(20, 0)).toBeNull()
  })
})
