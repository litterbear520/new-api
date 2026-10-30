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
import type { QuotaDataItem } from '@/features/dashboard/types'

import { FAMILY_KEYS, type FamilyKey } from '../constants'

const DAY = 86400
const WEEK = 7 * DAY
/** The chart and the month figures read this many calendar days back. */
export const CHART_DAYS = 30
/** Runway estimates stop here; beyond it the card says "over N days". */
export const RUNWAY_MAX_DAYS = 60

export function modelFamily(model: string): FamilyKey {
  const name = model.toLowerCase()
  if (
    name.includes('image') ||
    name.startsWith('dall-e') ||
    name.startsWith('imagen')
  ) {
    return 'image'
  }
  if (name.startsWith('claude')) return 'claude'
  if (name.startsWith('gemini') || name.startsWith('gemma')) return 'gemini'
  if (
    name.startsWith('gpt') ||
    name.startsWith('chatgpt') ||
    name.startsWith('codex') ||
    /^o\d/.test(name)
  ) {
    return 'gpt'
  }
  return 'other'
}

export function emptyFamilies(): Record<FamilyKey, number> {
  return { gpt: 0, claude: 0, gemini: 0, image: 0, other: 0 }
}

export interface DayBucket {
  /** Local midnight, unix seconds */
  start: number
  quota: Record<FamilyKey, number>
  tokens: Record<FamilyKey, number>
  requests: number
}

export interface UsageSummary {
  /** Oldest first; the last one is today */
  days: DayBucket[]
  todayQuota: number
  /** Average spend per day over the last 7 × 24 h of activity */
  perDayQuota: number
  monthQuota: number
  monthEndQuota: number
  /** Spend in the last 7 × 24 h compared with the 7 × 24 h before, or null */
  change: number | null
  topModel: { name: string; share: number } | null
  /** Spend per local hour of day over the last 7 × 24 h */
  hourShape: number[]
  /** Families with any spend or tokens in the chart window, in fixed order */
  families: FamilyKey[]
}

export function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** The earliest moment the summary needs: 30 days back or the month start. */
export function usageWindowStart(now: Date): number {
  const firstDay = addDays(localMidnight(now), 1 - CHART_DAYS)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  return Math.floor(Math.min(firstDay.getTime(), monthStart.getTime()) / 1000)
}

export function summarizeUsage(rows: QuotaDataItem[], now: Date): UsageSummary {
  const nowSec = Math.floor(now.getTime() / 1000)
  const today = localMidnight(now)
  const dayStarts = Array.from({ length: CHART_DAYS }, (_, i) =>
    Math.floor(addDays(today, i - CHART_DAYS + 1).getTime() / 1000)
  )
  const days: DayBucket[] = dayStarts.map((start) => ({
    start,
    quota: emptyFamilies(),
    tokens: emptyFamilies(),
    requests: 0,
  }))
  const monthStart = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  )
  const hourShape = Array.from({ length: 24 }, () => 0)
  const byModel = new Map<string, number>()
  let monthQuota = 0
  let last7 = 0
  let prev7 = 0
  let firstActive = Infinity

  for (const row of rows) {
    const at = Number(row.created_at) || 0
    const quota = Number(row.quota) || 0
    const family = modelFamily(row.model_name ?? '')
    if (at >= monthStart && at <= nowSec) monthQuota += quota
    if (quota > 0) firstActive = Math.min(firstActive, at)
    if (at > nowSec - WEEK) {
      last7 += quota
      hourShape[new Date(at * 1000).getHours()] += quota
      const name = row.model_name || '-'
      byModel.set(name, (byModel.get(name) ?? 0) + quota)
    } else if (at > nowSec - 2 * WEEK) {
      prev7 += quota
    }
    if (at < dayStarts[0]) continue
    let index = dayStarts.length - 1
    while (index > 0 && dayStarts[index] > at) index--
    const day = days[index]
    day.quota[family] += quota
    day.tokens[family] += Number(row.token_used) || 0
    day.requests += Number(row.count) || 0
  }

  // A user who started three days ago has not had a quiet week; average over
  // the days since their first spend in the window, from one day up to seven.
  const activeDays = Number.isFinite(firstActive)
    ? Math.min(7, Math.max(1, (nowSec - firstActive) / DAY))
    : 7
  const perDayQuota = last7 / activeDays
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const daysLeftInMonth = (nextMonth.getTime() - now.getTime()) / 1000 / DAY

  let topName = ''
  let topQuota = 0
  for (const [name, quota] of byModel) {
    if (quota > topQuota) {
      topName = name
      topQuota = quota
    }
  }

  return {
    days,
    todayQuota: FAMILY_KEYS.reduce(
      (total, key) => total + (days.at(-1)?.quota[key] ?? 0),
      0
    ),
    perDayQuota,
    monthQuota,
    monthEndQuota: monthQuota + perDayQuota * daysLeftInMonth,
    change: prev7 > 0 ? last7 / prev7 - 1 : null,
    topModel: topQuota > 0 ? { name: topName, share: topQuota / last7 } : null,
    hourShape,
    families: FAMILY_KEYS.filter((key) =>
      days.some((day) => day.quota[key] > 0 || day.tokens[key] > 0)
    ),
  }
}

/**
 * When the balance runs out, walking forward hour by hour with the user's own
 * hour-of-day pattern (little is spent at night). Null when nothing is being
 * spent, or when it lasts longer than RUNWAY_MAX_DAYS.
 */
export function estimateRunOut(
  balance: number,
  perDay: number,
  hourShape: number[],
  now: Date
): Date | null {
  if (balance <= 0) return now
  const total = hourShape.reduce((sum, value) => sum + value, 0)
  if (perDay <= 0 || total <= 0) return null
  let left = balance
  let at = new Date(now)
  for (let step = 0; step < 24 * RUNWAY_MAX_DAYS; step++) {
    const fraction = step === 0 ? (60 - at.getMinutes()) / 60 : 1
    left -= perDay * (hourShape[at.getHours()] / total) * fraction
    if (left <= 0) return at
    at = new Date(
      at.getFullYear(),
      at.getMonth(),
      at.getDate(),
      at.getHours() + 1
    )
  }
  return null
}

export type DayPart = 'night' | 'morning' | 'afternoon' | 'evening'

export function dayPart(date: Date): DayPart {
  const hour = date.getHours()
  if (hour < 6) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

/** Whole calendar days from now's date to the date of `at` */
export function calendarDaysFrom(now: Date, at: Date): number {
  return Math.round(
    (localMidnight(at).getTime() - localMidnight(now).getTime()) / 1000 / DAY
  )
}
