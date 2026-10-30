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

import { parsePlan } from '../api'

describe('parsePlan', () => {
  test('one picture keeps the user’s own words', () => {
    expect(parsePlan('{"count":1}')).toEqual({ parts: [], capped: false })
  })

  test('reads the parts inside a fenced reply', () => {
    const reply =
      '```json\n{"count":2,"pictures":[{"title":"红格纹款","prompt":"只画红格纹那款"},{"title":"蓝纯色款","prompt":"只画蓝色纯色那款"}]}\n```'
    expect(parsePlan(reply)).toEqual({
      parts: [
        { title: '红格纹款', text: '只画红格纹那款' },
        { title: '蓝纯色款', text: '只画蓝色纯色那款' },
      ],
      capped: false,
    })
  })

  test('keeps at most four and says the rest were left out', () => {
    const pictures = Array.from({ length: 6 }, (_, i) => ({
      title: `款 ${i + 1}`,
      prompt: `第 ${i + 1} 款`,
    }))
    const plan = parsePlan(JSON.stringify({ count: 6, pictures }))
    expect(plan?.parts).toHaveLength(4)
    expect(plan?.capped).toBe(true)
  })

  test('a split with fewer than two usable parts is one picture', () => {
    expect(
      parsePlan(
        '{"count":2,"pictures":[{"title":"a","prompt":""},{"title":"b","prompt":"x"}]}'
      )
    ).toEqual({ parts: [], capped: false })
  })

  test('an unreadable reply is null', () => {
    expect(parsePlan('sure, two pictures')).toBeNull()
    expect(parsePlan(undefined)).toBeNull()
  })
})
