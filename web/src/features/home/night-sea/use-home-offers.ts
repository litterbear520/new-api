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
import { useMemo } from 'react'

import { buildOffers, type Offer } from '@/features/activity/lib/offers'
import { usePayRules } from '@/features/bear-wallet/hooks/use-wallet-data'
import { useStatus } from '@/hooks/use-status'

/**
 * The offers running now, from the same numbers as the 活动 page and the
 * checkout; none until pay-bridge's rules have loaded.
 */
export function useHomeOffers(): Offer[] {
  const { status } = useStatus()
  const rules = usePayRules().data
  const price = status?.price
  const usdRate = status?.usd_exchange_rate
  return useMemo(
    () => (rules ? buildOffers({ price, usdRate, rules }) : []),
    [rules, price, usdRate]
  )
}

/** The one offer of a kind, if it runs */
export function offerOf<K extends Offer['kind']>(
  offers: Offer[],
  kind: K
): Extract<Offer, { kind: K }> | null {
  return (
    offers.find((offer): offer is Extract<Offer, { kind: K }> => {
      return offer.kind === kind
    }) ?? null
  )
}
