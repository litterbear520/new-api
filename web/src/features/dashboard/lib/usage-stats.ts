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
import { FAMILY_KEYS, type FamilyKey } from '@/features/bear-overview/constants'
import { emptyFamilies, modelFamily } from '@/features/bear-overview/lib/usage'
import dayjs from '@/lib/dayjs'

import type { FlowQuotaDataItem, QuotaDataItem } from '../types'

/**
 * The 「用量统计」 page: hourly quota rows from /api/data become chart slots,
 * totals and breakdown tables. Pure functions so the page stays thin.
 */
export const USAGE_METRICS = ['quota', 'requests', 'tokens'] as const
export type UsageMetric = (typeof USAGE_METRICS)[number]

export interface UsageTotals {
  quota: number
  requests: number
  tokens: number
}

export type SlotUnit = 'hour' | 'day'

export interface UsageSlot {
  /** Slot start, unix seconds */
  start: number
  values: Record<UsageMetric, Record<FamilyKey, number>>
}

/** More slots than this would be thinner than a pixel. */
const MAX_SLOTS = 400

function rowTotals(row: QuotaDataItem | FlowQuotaDataItem): UsageTotals {
  return {
    quota: Number(row.quota) || 0,
    requests: Number(row.count) || 0,
    tokens: Number(row.token_used) || 0,
  }
}

/** Hours for a range of up to two days, days for anything longer. */
export function slotUnit(start: Date, end: Date): SlotUnit {
  return end.getTime() - start.getTime() <= 2 * 86400_000 ? 'hour' : 'day'
}

export function bucketUsage(
  rows: QuotaDataItem[],
  start: Date,
  end: Date,
  unit: SlotUnit
): UsageSlot[] {
  const slots: UsageSlot[] = []
  let at = dayjs(start).startOf(unit)
  while (!at.isAfter(end) && slots.length < MAX_SLOTS) {
    slots.push({
      start: at.unix(),
      values: {
        quota: emptyFamilies(),
        requests: emptyFamilies(),
        tokens: emptyFamilies(),
      },
    })
    at = at.add(1, unit)
  }
  if (!slots.length) return slots

  for (const row of rows) {
    const time = Number(row.created_at) || 0
    if (time < slots[0].start) continue
    let index = slots.length - 1
    while (index > 0 && slots[index].start > time) index--
    const family = modelFamily(row.model_name ?? '')
    const totals = rowTotals(row)
    for (const metric of USAGE_METRICS) {
      slots[index].values[metric][family] += totals[metric]
    }
  }
  return slots
}

export function sumUsage(
  rows: ReadonlyArray<QuotaDataItem | FlowQuotaDataItem>
): UsageTotals {
  const sum: UsageTotals = { quota: 0, requests: 0, tokens: 0 }
  for (const row of rows) {
    const totals = rowTotals(row)
    sum.quota += totals.quota
    sum.requests += totals.requests
    sum.tokens += totals.tokens
  }
  return sum
}

/** Families with any usage in the slots, in stacking order. */
export function slotFamilies(slots: UsageSlot[]): FamilyKey[] {
  return FAMILY_KEYS.filter((key) =>
    slots.some((slot) => USAGE_METRICS.some((m) => slot.values[m][key] > 0))
  )
}

export interface BreakdownRow extends UsageTotals {
  id: string
  name: string
  family?: FamilyKey
  /** Opens the logs filtered to this row; absent for deleted keys. */
  logs?: { model?: string; token?: string; username?: string }
  /** API key status (1 enabled, 2 disabled, 3 expired, 4 exhausted) */
  status?: number
  /** Unix seconds of the key's last request, or null when never used */
  lastUsed?: number | null
}

function addTo(target: UsageTotals, totals: UsageTotals) {
  target.quota += totals.quota
  target.requests += totals.requests
  target.tokens += totals.tokens
}

/** What the site-wide table can group by besides keys */
export type UsageGroup = 'model' | 'user'

/** Usage per model or per user; rows without one are summed under 「-」. */
export function usageBy(
  group: UsageGroup,
  rows: QuotaDataItem[]
): BreakdownRow[] {
  const byName = new Map<string, BreakdownRow>()
  for (const row of rows) {
    const value = group === 'model' ? row.model_name : row.username
    const name = value || '-'
    let entry = byName.get(name)
    if (!entry) {
      const logs = group === 'model' ? { model: name } : { username: name }
      entry = {
        id: `${group}:${name}`,
        name,
        family: group === 'model' ? modelFamily(name) : undefined,
        logs: value ? logs : undefined,
        quota: 0,
        requests: 0,
        tokens: 0,
      }
      byName.set(name, entry)
    }
    addTo(entry, rowTotals(row))
  }
  return [...byName.values()]
}

export interface UsageKey {
  id: number
  name: string
  status: number
  created_time: number
  accessed_time: number
}

/**
 * Usage per API key. Every current key is listed, unused ones with zeros, so
 * the table doubles as 「which keys are idle」. Keys made a request when their
 * last access is later than their creation (New API sets both on create).
 */
export function usageByKey(
  rows: FlowQuotaDataItem[],
  keys: UsageKey[],
  labels: { deleted: (id: number) => string; unknown: string }
): BreakdownRow[] {
  const byId = new Map<number, BreakdownRow>()
  for (const key of keys) {
    byId.set(key.id, {
      id: `key:${key.id}`,
      name: key.name,
      logs: { token: key.name },
      status: key.status,
      lastUsed: key.accessed_time > key.created_time ? key.accessed_time : null,
      quota: 0,
      requests: 0,
      tokens: 0,
    })
  }
  for (const row of rows) {
    const id = Number(row.token_id) || 0
    let entry = byId.get(id)
    if (!entry) {
      const name =
        row.token_name || (id > 0 ? labels.deleted(id) : labels.unknown)
      entry = {
        id: `key:${id}`,
        name,
        logs: row.token_name ? { token: row.token_name } : undefined,
        quota: 0,
        requests: 0,
        tokens: 0,
      }
      byId.set(id, entry)
    }
    addTo(entry, rowTotals(row))
  }
  return [...byId.values()]
}

/** Largest first by the chosen metric, then by spend, then by name. */
export function sortBreakdown(
  rows: BreakdownRow[],
  metric: UsageMetric
): BreakdownRow[] {
  return [...rows].sort(
    (a, b) =>
      b[metric] - a[metric] || b.quota - a.quota || a.name.localeCompare(b.name)
  )
}
