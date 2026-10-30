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

import { PublicLayout } from '@/components/layout'
import {
  usePayRules,
  useSelfSubscriptions,
} from '@/features/bear-wallet/hooks/use-wallet-data'
import { starterOpen } from '@/features/bear-wallet/lib/packs'
import { NO_RULES } from '@/features/bear-wallet/lib/rules'
import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'

import {
  ActivityContent,
  type StarterState,
} from './components/activity-content'
import { buildOffers } from './lib/offers'

import './activity.css'

/** 活动: the public page with every running offer */
export function Activity() {
  const { status, loading } = useStatus()
  const rules = usePayRules()
  const signedIn = useAuthStore((state) => Boolean(state.auth.user))
  const subscriptions = useSelfSubscriptions(signedIn)

  const offers = useMemo(
    () =>
      buildOffers({
        price: status?.price,
        usdRate: status?.usd_exchange_rate,
        rules: rules.data ?? NO_RULES,
      }),
    [status?.price, status?.usd_exchange_rate, rules.data]
  )

  const first = rules.data?.first ?? null
  let starter: StarterState = 'guest'
  if (signedIn) {
    // Only say "claimed" when the subscriptions prove it
    const claimed =
      Boolean(first?.planId) &&
      subscriptions.data !== undefined &&
      !starterOpen(first, subscriptions.data)
    starter = claimed ? 'claimed' : 'open'
  }

  return (
    <PublicLayout showMainContainer={false}>
      <ActivityContent
        offers={offers}
        loading={(loading && !status) || rules.isLoading}
        starter={starter}
      />
    </PublicLayout>
  )
}
