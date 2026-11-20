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

import { orderTime, percentText } from '../format'

const at = (iso: string) => new Date(iso).getTime() / 1000
const now = new Date('2026-11-20T12:00:00')

describe('orderTime', () => {
  test('midnight is 00, not 24', () => {
    expect(orderTime(at('2026-11-20T00:05:00'), 'en-US', now)).toMatch(/00:05/)
    expect(orderTime(at('2026-11-20T00:05:00'), 'en-US', now)).not.toMatch(
      /24:05/
    )
  })

  test('this year leaves the year out', () => {
    expect(orderTime(at('2026-03-04T14:58:00'), 'en-US', now)).not.toMatch(
      /2026/
    )
  })

  test('an order from another year says which', () => {
    expect(orderTime(at('2025-12-31T14:58:00'), 'en-US', now)).toMatch(/2025/)
    expect(orderTime(at('2025-12-31T14:58:00'), 'zh-CN', now)).toMatch(/2025/)
  })
})

describe('percentText', () => {
  test('writes a share the way each language does', () => {
    expect(percentText(0.125, 'en-US', 1)).toBe('12.5%')
    expect(percentText(0.125, 'fr', 1)).toMatch(/^12,5\s%$/)
    expect(percentText(0.03, 'zh-CN')).toBe('3%')
  })
})
