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
import dayjs from '@/lib/dayjs'

/**
 * Time ranges of the logs toolbar. The URL keeps plain start and end times;
 * the label is found again by matching them against the presets, so an old
 * link shows its real dates instead of a stale 「今天」.
 */
export const TIME_PRESETS = ['today', '7d', '30d', 'month'] as const
export type TimePreset = (typeof TIME_PRESETS)[number]

export const TIME_PRESET_LABELS: Record<TimePreset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  month: 'Current month',
}

export function presetRange(
  preset: TimePreset,
  now: Date = new Date()
): { start: Date; end: Date } {
  const day = dayjs(now)
  const end = day.endOf('day').toDate()
  const starts: Record<TimePreset, Date> = {
    today: day.startOf('day').toDate(),
    '7d': day.subtract(6, 'day').startOf('day').toDate(),
    '30d': day.subtract(29, 'day').startOf('day').toDate(),
    month: day.startOf('month').toDate(),
  }
  return { start: starts[preset], end }
}

/**
 * The preset these times came from, or null for a custom range. Some days two
 * presets give the same range (on the 1st 「今天」 is 「本月」); then the one
 * the user picked wins, if known.
 */
export function matchPreset(
  start: Date | undefined,
  end: Date | undefined,
  now: Date = new Date(),
  picked: TimePreset | null = null
): TimePreset | null {
  if (!start || !end) return null
  // Presets end at midnight and the default range an hour from now; either
  // way the range still covers now and ends by tomorrow's first hour.
  const latestEnd = dayjs(now).endOf('day').add(1, 'hour').valueOf()
  if (end.getTime() < now.getTime() - 60_000 || end.getTime() > latestEnd) {
    return null
  }
  const matches = TIME_PRESETS.filter(
    (preset) => presetRange(preset, now).start.getTime() === start.getTime()
  )
  if (picked && matches.includes(picked)) return picked
  return matches[0] ?? null
}

/** The value of a datetime-local field (local time, with seconds). */
export function toInputValue(date?: Date): string {
  return date ? dayjs(date).format('YYYY-MM-DDTHH:mm:ss') : ''
}

/** The time in a datetime-local field, or undefined when empty or broken. */
export function fromInputValue(value: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** Short label of a custom range: dates only when it covers whole days. */
export function formatRangeLabel(
  start: Date | undefined,
  end: Date | undefined,
  now: Date = new Date()
): string {
  if (!start || !end) return ''
  const from = dayjs(start)
  const to = dayjs(end)
  const sameYear =
    from.year() === dayjs(now).year() && to.year() === from.year()
  const wholeDays =
    from.isSame(from.startOf('day')) && to.isSame(to.endOf('day'), 'second')
  const date = sameYear ? 'MM-DD' : 'YYYY-MM-DD'
  if (wholeDays) {
    return from.isSame(to, 'day')
      ? from.format(date)
      : `${from.format(date)} – ${to.format(date)}`
  }
  if (from.isSame(to, 'day')) {
    return `${from.format(`${date} HH:mm`)} – ${to.format('HH:mm')}`
  }
  return `${from.format(`${date} HH:mm`)} – ${to.format(`${date} HH:mm`)}`
}
