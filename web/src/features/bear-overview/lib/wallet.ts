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

export interface WalletGauge {
  /** Everything the balance held since the anchor, in quota units */
  total: number
  /** Balance ÷ total, 0 to 1 */
  left: number
  /** Unix seconds of the last top-up, or null when the gauge is lifetime */
  since: number | null
}

/**
 * The wallet card fills like a battery: what is left of everything that came
 * in since the last top-up (balance now + spent since then). Without a top-up
 * on record it falls back to the lifetime total (balance + all usage).
 */
export function walletGauge(args: {
  balance: number
  usedQuota: number
  lastTopUpAt: number | null
  spentSinceTopUp: number | null
}): WalletGauge {
  const balance = Math.max(0, args.balance)
  const anchored = args.lastTopUpAt != null && args.spentSinceTopUp != null
  const total = anchored
    ? balance + Math.max(0, args.spentSinceTopUp ?? 0)
    : balance + Math.max(0, args.usedQuota)
  return {
    total,
    left: total > 0 ? Math.min(1, balance / total) : 0,
    since: anchored ? args.lastTopUpAt : null,
  }
}

/** How many days an amount lasts at the current pace, or null if not spending */
export function daysCovered(amount: number, perDay: number): number | null {
  if (perDay <= 0) return null
  return amount / perDay
}
