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
import type { SuccessRatePoint } from '@/features/performance-metrics/types'

const HOURS = 24
const HOUR = 3600

export type HourSlot = { ts: number; rate: number | null }

/** One slot per hour of the last day, oldest first; hours without requests stay empty */
export function hourSlots(
  series: SuccessRatePoint[] | undefined,
  windowEnd: number
): HourSlot[] {
  const rates = new Map<number, number>()
  for (const point of series ?? []) {
    if (
      Number.isFinite(point.ts) &&
      Number.isFinite(point.success_rate) &&
      point.success_rate >= 0 &&
      point.success_rate <= 100
    ) {
      rates.set(point.ts - (point.ts % HOUR), point.success_rate)
    }
  }
  const last = windowEnd - (windowEnd % HOUR)
  return Array.from({ length: HOURS }, (_, i) => {
    const ts = last - (HOURS - 1 - i) * HOUR
    return { ts, rate: rates.get(ts) ?? null }
  })
}

/** The newest sample, so a strip without server window still ends on real data */
export function latestSampleTs(
  series: SuccessRatePoint[] | undefined
): number | undefined {
  let latest: number | undefined
  for (const point of series ?? []) {
    if (
      Number.isFinite(point.ts) &&
      (latest === undefined || point.ts > latest)
    ) {
      latest = point.ts
    }
  }
  return latest
}
