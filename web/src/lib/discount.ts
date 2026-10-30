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
/**
 * Top-up deals: the site sells $1 of credit for `priceRate` yuan (New API's
 * Price), while $1 costs `usdExchangeRate` yuan at the bank. Model prices are
 * the official USD ones, so the deal is the share of the official price paid.
 */

/** True when $1 of credit costs less than $1 at the exchange rate */
export function isDiscounted(
  priceRate: number,
  usdExchangeRate: number
): boolean {
  return priceRate > 0 && priceRate < usdExchangeRate
}

/** A share of the official price, one decimal and two under 1%: 1.43 → "1.4%" */
export function formatSharePercent(percent: number): string {
  return `${percent.toFixed(percent < 1 ? 2 : 1).replace(/\.0+$/, '')}%`
}
