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

import {
  formatRangeLabel,
  fromInputValue,
  matchPreset,
  presetRange,
  toInputValue,
} from '../time-range'

// Tuesday 27 October 2026, 14:30 local time.
const now = new Date(2026, 9, 27, 14, 30)

describe('logs time presets', () => {
  it('covers whole days up to the end of today', () => {
    expect(presetRange('today', now)).toEqual({
      start: new Date(2026, 9, 27),
      end: new Date(2026, 9, 27, 23, 59, 59, 999),
    })
    expect(presetRange('7d', now).start).toEqual(new Date(2026, 9, 21))
    expect(presetRange('30d', now).start).toEqual(new Date(2026, 8, 28))
    expect(presetRange('month', now).start).toEqual(new Date(2026, 9, 1))
  })

  it('names the default range, which ends an hour from now, as today', () => {
    const start = new Date(2026, 9, 27)
    const end = new Date(now.getTime() + 3600 * 1000)
    expect(matchPreset(start, end, now)).toBe('today')
  })

  it('recognises each preset it produced', () => {
    for (const preset of ['today', '7d', '30d'] as const) {
      const range = presetRange(preset, now)
      expect(matchPreset(range.start, range.end, now)).toBe(preset)
    }
  })

  it.each([
    ['today', 1],
    ['7d', 7],
  ] as const)(
    'keeps 本月 when the user picked it although %s covers the same days',
    (_other, day) => {
      const date = new Date(2026, 10, day, 9)
      const month = presetRange('month', date)
      expect(matchPreset(month.start, month.end, date, 'month')).toBe('month')
    }
  )

  it('ignores a picked preset that no longer matches the range', () => {
    const range = presetRange('7d', now)
    expect(matchPreset(range.start, range.end, now, 'month')).toBe('7d')
  })

  it('treats an old or open-ended link as a custom range', () => {
    const yesterday = presetRange('today', new Date(2026, 9, 26, 9))
    expect(matchPreset(yesterday.start, yesterday.end, now)).toBeNull()
    expect(
      matchPreset(new Date(2026, 9, 27), new Date(2027, 0, 1), now)
    ).toBeNull()
    expect(matchPreset(undefined, undefined, now)).toBeNull()
  })
})

describe('custom range labels', () => {
  it('shows dates only for whole days and drops this year', () => {
    expect(
      formatRangeLabel(
        new Date(2026, 9, 1),
        new Date(2026, 9, 5, 23, 59, 59),
        now
      )
    ).toBe('10-01 – 10-05')
    expect(
      formatRangeLabel(
        new Date(2026, 9, 3),
        new Date(2026, 9, 3, 23, 59, 59, 999),
        now
      )
    ).toBe('10-03')
  })

  it('shows times when the range starts or ends inside a day', () => {
    expect(
      formatRangeLabel(
        new Date(2026, 9, 3, 9, 30),
        new Date(2026, 9, 3, 18, 0),
        now
      )
    ).toBe('10-03 09:30 – 18:00')
    expect(
      formatRangeLabel(
        new Date(2025, 11, 31, 22, 0),
        new Date(2026, 0, 1, 2, 0),
        now
      )
    ).toBe('2025-12-31 22:00 – 2026-01-01 02:00')
  })
})

describe('datetime-local field values', () => {
  it('writes a local time with seconds and reads it back unchanged', () => {
    const time = new Date(2026, 9, 27, 9, 5, 7)
    expect(toInputValue(time)).toBe('2026-10-27T09:05:07')
    expect(fromInputValue(toInputValue(time))).toEqual(time)
  })

  it('leaves an empty field empty and rejects a broken value', () => {
    expect(toInputValue(undefined)).toBe('')
    expect(fromInputValue('')).toBeUndefined()
    expect(fromInputValue('2026-13-45T99:99')).toBeUndefined()
  })
})
