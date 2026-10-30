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

import type { QuotaDataItem } from '@/features/dashboard/types'

import {
  calendarDaysFrom,
  dayPart,
  estimateRunOut,
  modelFamily,
  summarizeUsage,
  usageWindowStart,
} from '../usage'

const QUOTA = 500000 // one dollar
// Sunday 25 October 2026, 15:40 local time
const NOW = new Date(2026, 9, 25, 15, 40)
const at = (days: number, hour: number) =>
  Math.floor(new Date(2026, 9, 25 - days, hour).getTime() / 1000)
const row = (
  created_at: number,
  quota: number,
  model_name = 'gpt-6.1-sol',
  count = 1
): QuotaDataItem => ({
  created_at,
  quota,
  model_name,
  count,
  token_used: quota * 2,
})

describe('modelFamily', () => {
  test('names map to the family they are billed and charted under', () => {
    expect(modelFamily('gpt-6.1-sol')).toBe('gpt')
    expect(modelFamily('o3-mini')).toBe('gpt')
    expect(modelFamily('claude-sonnet-4-6')).toBe('claude')
    expect(modelFamily('gemini-3.8-flash')).toBe('gemini')
    expect(modelFamily('gpt-image-2')).toBe('image')
    expect(modelFamily('gemini-3.1-flash-image')).toBe('image')
    expect(modelFamily('deepseek-v4')).toBe('other')
  })
})

describe('usageWindowStart', () => {
  test('reaches back 30 calendar days, or to the month start if earlier', () => {
    expect(usageWindowStart(NOW)).toBe(
      Math.floor(new Date(2026, 8, 26).getTime() / 1000)
    )
    const lateMonth = new Date(2026, 9, 31, 12)
    expect(usageWindowStart(lateMonth)).toBe(
      Math.floor(new Date(2026, 9, 1).getTime() / 1000)
    )
  })
})

describe('summarizeUsage', () => {
  test('today, the month and the 7-day comparison come from the hourly rows', () => {
    const rows = [
      row(at(0, 9), 2 * QUOTA),
      row(at(0, 14), QUOTA, 'claude-sonnet-4-6'),
      row(at(3, 10), 4 * QUOTA),
      row(at(10, 10), 7 * QUOTA),
      row(at(28, 10), 5 * QUOTA),
    ]
    const summary = summarizeUsage(rows, NOW)

    expect(summary.days).toHaveLength(30)
    expect(summary.todayQuota).toBe(3 * QUOTA)
    expect(summary.days.at(-1)?.quota.claude).toBe(QUOTA)
    // October only: today, 3 days ago and 10 days ago
    expect(summary.monthQuota).toBe(14 * QUOTA)
    // last 7 × 24 h: 7 dollars against 7 dollars the week before
    expect(summary.change).toBe(0)
    expect(summary.perDayQuota).toBe(QUOTA)
    expect(summary.topModel).toEqual({ name: 'gpt-6.1-sol', share: 6 / 7 })
    expect(summary.families).toEqual(['gpt', 'claude'])
  })

  test('a user who started yesterday is averaged over the days since', () => {
    const rows = [row(at(1, 15) + 2400, 2 * QUOTA), row(at(0, 15), 2 * QUOTA)]
    const summary = summarizeUsage(rows, NOW)
    // first spend one day ago: four dollars over one day
    expect(summary.perDayQuota).toBeCloseTo(4 * QUOTA, 0)
    expect(summary.change).toBeNull()
  })

  test('the month-end projection adds the daily pace for the days left', () => {
    const rows = [
      row(at(1, 12), 7 * QUOTA),
      row(at(6, 23), 0, 'gpt-6.1-sol', 0),
    ]
    const summary = summarizeUsage(rows, new Date(2026, 9, 31, 0, 0))
    const perDay = summary.perDayQuota
    expect(summary.monthEndQuota).toBeCloseTo(summary.monthQuota + perDay, 0)
  })

  test('no rows give an empty summary', () => {
    const summary = summarizeUsage([], NOW)
    expect(summary.todayQuota).toBe(0)
    expect(summary.perDayQuota).toBe(0)
    expect(summary.topModel).toBeNull()
    expect(summary.families).toEqual([])
  })
})

describe('estimateRunOut', () => {
  const daytime = Array.from({ length: 24 }, (_, hour) =>
    hour >= 9 && hour < 18 ? 1 : 0
  )

  test('nothing spent means no run-out date', () => {
    expect(estimateRunOut(QUOTA, 0, daytime, NOW)).toBeNull()
  })

  test('an empty balance has already run out', () => {
    expect(estimateRunOut(0, QUOTA, daytime, NOW)).toEqual(NOW)
  })

  test('quiet night hours are skipped, so the balance lasts into tomorrow morning', () => {
    //  a day spread over 9 working hours; /bin/bash.5 left at 15:40
    const out = estimateRunOut(QUOTA / 2, QUOTA, daytime, NOW)
    expect(out).not.toBeNull()
    expect(calendarDaysFrom(NOW, out as Date)).toBe(1)
    expect(dayPart(out as Date)).toBe('morning')
  })

  test('a pace that lasts beyond the limit gives no date', () => {
    expect(estimateRunOut(1000 * QUOTA, QUOTA, daytime, NOW)).toBeNull()
  })
})

describe('dayPart', () => {
  test('splits the day at 6, 12 and 18', () => {
    expect(dayPart(new Date(2026, 9, 25, 5))).toBe('night')
    expect(dayPart(new Date(2026, 9, 25, 6))).toBe('morning')
    expect(dayPart(new Date(2026, 9, 25, 12))).toBe('afternoon')
    expect(dayPart(new Date(2026, 9, 25, 18))).toBe('evening')
  })
})
