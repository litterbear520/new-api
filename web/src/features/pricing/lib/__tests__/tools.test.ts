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
import { describe, expect, it } from 'vitest'

import type { PricingModel } from '../../types'
import { hourSlots, latestSampleTs } from '../hour-slots'
import { formatYuan, getModelTools, isImageModel } from '../tools'

function model(overrides: Partial<PricingModel>): PricingModel {
  return {
    id: 1,
    model_name: 'example',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    ...overrides,
  }
}

describe('formatYuan', () => {
  it.each([
    [5, 0.1, '¥0.5'],
    [6.25, 0.1, '¥0.625'],
    [0.025, 0.1, '¥0.0025'],
    [0, 0.1, '¥0'],
    [0.0001, 0.1, '<¥0.0001'],
    [12345, 0.1, '¥1,234.5'],
  ])('$%s at ¥%s per dollar is %s', (usd, rate, expected) => {
    expect(formatYuan(usd, rate)).toBe(expected)
  })

  it.each([
    ['zh-CN', '¥1,234.5', '<¥0.0001'],
    ['fr', '1\u202f234,5\u00a0¥', '<0,0001\u00a0¥'],
  ])('writes yuan the %s way', (locale, amount, floor) => {
    expect(formatYuan(12345, 0.1, locale)).toBe(amount)
    expect(formatYuan(0.0001, 0.1, locale)).toBe(floor)
  })

  it.each([
    [Number.NaN, 0.1],
    [-1, 0.1],
    [5, 0],
    [5, Number.NaN],
  ])('gives nothing for $%s at rate %s', (usd, rate) => {
    expect(formatYuan(usd, rate)).toBeNull()
  })
})

describe('getModelTools', () => {
  it.each([
    ['claude-sonnet-4-6', undefined, 'claude-code'],
    ['my-proxy-model', 'Anthropic', 'claude-code'],
    ['gpt-6-sol', undefined, 'codex'],
    ['o4-mini', undefined, 'codex'],
    ['gemini-3-flash', undefined, 'gemini-cli'],
    ['some-model', 'Google', 'gemini-cli'],
  ])('%s from %s works with %s', (name, vendor, tool) => {
    expect(
      getModelTools(model({ model_name: name, vendor_name: vendor })).map(
        (item) => item.id
      )
    ).toEqual([tool])
  })

  it('sends image models to the drawing page, by name or endpoint', () => {
    for (const item of [
      model({ model_name: 'gpt-image-2', vendor_name: 'OpenAI' }),
      model({ model_name: 'gemini-3.1-flash-image', vendor_name: 'Google' }),
      model({
        model_name: 'painter',
        supported_endpoint_types: ['image-generation'],
      }),
    ]) {
      expect(isImageModel(item)).toBe(true)
      expect(getModelTools(item).map((tool) => tool.id)).toEqual(['draw'])
    }
  })

  it('leaves unknown families without a tool', () => {
    expect(getModelTools(model({ model_name: 'deepseek-v4' }))).toEqual([])
  })
})

describe('hourSlots', () => {
  it('keeps one slot per hour, the window end last, and empty hours as null', () => {
    const slots = hourSlots(
      [
        { ts: 36_000, success_rate: 99 },
        { ts: 36_000 - 7200, success_rate: 50 },
      ],
      36_000 + 1200
    )
    expect(slots).toHaveLength(24)
    expect(slots[23]).toEqual({ ts: 36_000, rate: 99 })
    expect(slots[22]).toEqual({ ts: 32_400, rate: null })
    expect(slots[21]).toEqual({ ts: 28_800, rate: 50 })
    expect(slots[0].ts).toBe(36_000 - 23 * 3600)
  })

  it('finds the newest sample with a usable time', () => {
    expect(
      latestSampleTs([
        { ts: 3600, success_rate: 1 },
        { ts: Number.NaN, success_rate: 1 },
        { ts: 7200, success_rate: 1 },
      ])
    ).toBe(7200)
    expect(latestSampleTs(undefined)).toBeUndefined()
  })
})
