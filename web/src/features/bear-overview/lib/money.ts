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
import { formatQuotaWithCurrency, getCurrencyDisplay } from '@/lib/currency'

/** Quota units in one US dollar (the site's QuotaPerUnit) */
export function quotaPerUnit(): number {
  return getCurrencyDisplay().config.quotaPerUnit || 500000
}

/** A quota amount in the site's display currency, two decimals at most. */
export function money(quota: number, locale?: string): string {
  return formatQuotaWithCurrency(quota, {
    digitsLarge: 2,
    digitsSmall: 2,
    abbreviate: false,
    locale,
  })
}

/** Chart axis labels: no cents above ten, more decimals below a dime. */
export function axisMoney(quota: number, locale?: string): string {
  const usd = quota / quotaPerUnit()
  let digitsSmall = 4
  if (usd >= 0.1) digitsSmall = 2
  else if (usd >= 0.01) digitsSmall = 3
  return formatQuotaWithCurrency(quota, {
    digitsLarge: usd < 10 ? 2 : 0,
    digitsSmall,
    abbreviate: true,
    locale,
  })
}
