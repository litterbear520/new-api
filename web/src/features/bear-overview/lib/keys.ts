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
import type { FlowQuotaDataItem } from '@/features/dashboard/types'
import { DRAW_TOKEN_NAME } from '@/features/draw/constants'
import type { ApiKey } from '@/features/keys/types'

/** Rows shown under 「密钥额度」 */
export const KEY_ROWS = 5

export interface KeyRow {
  key: ApiKey
  /** Spent in the last 30 days, in quota units */
  recent: number
  /** Used ÷ limit, only for keys with a limit */
  usedShare: number | null
}

/** Keys the user made: the draw page's own key is left out. */
export function userKeys(keys: ApiKey[]): ApiKey[] {
  return keys.filter((key) => key.name !== DRAW_TOKEN_NAME)
}

/** The key to offer for copying: the one used last, else the newest. */
export function recentKey(keys: ApiKey[]): ApiKey | null {
  const usable = userKeys(keys).filter((key) => key.status === 1)
  if (!usable.length) return null
  return usable.reduce((best, key) => {
    const a = key.accessed_time || key.created_time
    const b = best.accessed_time || best.created_time
    return a > b ? key : best
  })
}

export function spendByKey(rows: FlowQuotaDataItem[]): Map<number, number> {
  const spend = new Map<number, number>()
  for (const row of rows) {
    if (!row.token_id) continue
    spend.set(row.token_id, (spend.get(row.token_id) ?? 0) + (row.quota || 0))
  }
  return spend
}

/**
 * Keys with a limit come first, fullest first; then keys without one, the
 * biggest spender first. Disabled and expired keys are left out.
 */
export function keyRows(keys: ApiKey[], spend: Map<number, number>): KeyRow[] {
  const rows = userKeys(keys)
    .filter((key) => key.status === 1 || key.status === 4)
    .map((key): KeyRow => {
      const limit = key.remain_quota + key.used_quota
      return {
        key,
        recent: spend.get(key.id) ?? 0,
        usedShare:
          key.unlimited_quota || limit <= 0
            ? null
            : Math.min(1, key.used_quota / limit),
      }
    })
  rows.sort((a, b) => {
    if ((a.usedShare === null) !== (b.usedShare === null)) {
      return a.usedShare === null ? 1 : -1
    }
    if (a.usedShare !== null && b.usedShare !== null) {
      return b.usedShare - a.usedShare
    }
    return b.recent - a.recent
  })
  return rows.slice(0, KEY_ROWS)
}
