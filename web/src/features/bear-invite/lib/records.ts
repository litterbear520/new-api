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
import { parseLogOther } from '@/features/usage-logs/lib/format'

/** The system log New API writes for the inviter when a friend signs up */
export const INVITER_LOG_KEY = 'Bonus for inviting a user {{quota}}'

export interface InviteRecord {
  id: number
  /** Unix seconds */
  createdAt: number
  /** Dollars, when the log's amount is in dollars */
  usd: number | null
  /** The amount as New API wrote it, for any other display unit */
  raw: string
}

interface LogRow {
  id: number
  created_at: number
  other?: string | null
}

/**
 * The invite rewards among the user's system logs, newest first. New API
 * writes the amount as text ("＄5.000000" in dollar display); anything not in
 * dollars is kept as written.
 */
export function inviteRecords(logs: LogRow[]): InviteRecord[] {
  const records: InviteRecord[] = []
  for (const log of logs) {
    // Most system logs carry no structured content; skip them unparsed.
    if (!log.other?.startsWith('{')) continue
    const parts = parseLogOther(log.other)?.content_parts ?? []
    const part = parts.find((item) => item?.key === INVITER_LOG_KEY)
    if (!part) continue
    const raw = String(part.params?.quota ?? '').trim()
    const match = /^[$＄]\s*([\d.]+)$/.exec(raw)
    const usd = match ? Number(match[1]) : null
    records.push({
      id: log.id,
      createdAt: log.created_at,
      usd: usd !== null && Number.isFinite(usd) ? usd : null,
      raw,
    })
  }
  return records.sort((a, b) => b.createdAt - a.createdAt)
}
