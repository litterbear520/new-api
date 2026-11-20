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
import { formatCurrencyFromUSD } from '@/lib/currency'
import type { AuthUser } from '@/stores/auth-store'

/** Dollars of quota, without cents when whole: $1,000 · $12.50 */
export function usd(amount: number, locale?: string): string {
  return formatCurrencyFromUSD(amount, {
    digitsLarge: Number.isInteger(amount) ? 0 : 2,
    digitsSmall: 2,
    abbreviate: false,
    locale,
  })
}

/** The sign-in a user would recognise, so they top up the right account */
export function loginMethod(
  user: AuthUser | null,
  names: { oidc?: string; wechat: string; email: string }
): string | null {
  if (!user) return null
  if (user.github_id) return 'GitHub'
  if (user.oidc_id) return names.oidc || 'OIDC'
  if (user.linux_do_id) return 'LINUX DO'
  if (user.discord_id) return 'Discord'
  if (user.telegram_id) return 'Telegram'
  if (user.wechat_id) return names.wechat
  if (user.email) return names.email
  return null
}

/** Month and day in the reader's locale: 11月8日 · Nov 8 */
export function monthDay(unixSeconds: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
  }).format(new Date(unixSeconds * 1000))
}

/**
 * Date and time of an order: 10月25日 14:58 · Oct 25, 14:58, with the year
 * once it is not this year's. h23 runs 00–23: some engines turn hour12 false
 * into h24, which shows midnight as 24:05 in English.
 */
export function orderTime(
  unixSeconds: number,
  locale?: string,
  now = new Date()
): string {
  const at = new Date(unixSeconds * 1000)
  return new Intl.DateTimeFormat(locale, {
    ...(at.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at)
}

/** A share as the language writes it: 12.5% · 12,5 % (fr). */
export function percentText(share: number, locale?: string, digits = 0) {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(share)
}
