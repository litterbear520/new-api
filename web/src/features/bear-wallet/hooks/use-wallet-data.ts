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
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { overviewKeys } from '@/features/bear-overview/hooks/use-overview-data'
import { usageWindowStart } from '@/features/bear-overview/lib/usage'
import { getUserQuotaDates } from '@/features/dashboard/api'
import {
  getPublicPlans,
  getSelfSubscriptionFull,
} from '@/features/subscriptions/api'
import { getTopupInfo } from '@/features/wallet/api'
import { getSelf } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import type { AuthUser } from '@/stores/auth-store'

import { PAY_RULES_URL, walletKeys } from '../constants'
import { activePacks, packsLeft } from '../lib/packs'
import { NO_RULES, parseRules } from '../lib/rules'

const nowSeconds = () => Math.floor(Date.now() / 1000)

async function fetchRules() {
  try {
    const res = await fetch(PAY_RULES_URL, { credentials: 'same-origin' })
    if (!res.ok) return NO_RULES
    return parseRules(await res.json())
  } catch {
    return NO_RULES
  }
}

/** pay-bridge's public rules: bonus tiers, the 新人礼包 and invite rewards */
export function usePayRules() {
  return useQuery({
    queryKey: walletKeys.rules,
    queryFn: fetchRules,
    staleTime: 5 * 60 * 1000,
  })
}

/** New API's top-up settings: pay methods, minimum, links, compliance */
export function useTopupInfo() {
  return useQuery({
    queryKey: walletKeys.topupInfo,
    queryFn: async () => {
      const res = requireServerSuccess(await getTopupInfo())
      return res.data ?? null
    },
    staleTime: 5 * 60 * 1000,
  })
}

/** All of the user's subscriptions, expired ones included */
export function useSelfSubscriptions(enabled = true) {
  return useQuery({
    queryKey: walletKeys.subscriptions,
    queryFn: async () => {
      const res = requireServerSuccess(await getSelfSubscriptionFull())
      const all = res.data?.all_subscriptions ?? []
      return all.map((record) => record.subscription)
    },
    enabled,
    staleTime: 30 * 1000,
  })
}

/** Credit left in packs (bonus, gift), which New API spends before the wallet */
export function useHeldCredit(): number {
  const subscriptions = useSelfSubscriptions()
  return useMemo(
    () =>
      packsLeft(
        activePacks(
          subscriptions.data ?? [],
          NO_RULES,
          Math.floor(Date.now() / 1000)
        )
      ),
    [subscriptions.data]
  )
}

/** The signed-in user, on the overview's cache key */
export function useSelf() {
  return useQuery({
    queryKey: overviewKeys.self,
    queryFn: async () => {
      const res = requireServerSuccess(await getSelf())
      return (res.data ?? null) as AuthUser | null
    },
    staleTime: 30 * 1000,
  })
}

/**
 * Everything the wallet reads. The user and the 7-day usage share the
 * overview's cache keys, so a top-up refreshes both pages.
 */
export function useWalletData(known: AuthUser | null) {
  const self = useSelf()
  const user = self.data ?? known
  const hasUsage = Boolean(user) && Number(user?.request_count ?? 0) > 0

  const windowStart = usageWindowStart(new Date())
  const usage = useQuery({
    queryKey: [...overviewKeys.all, 'usage', windowStart],
    queryFn: async () => {
      const res = requireServerSuccess(
        await getUserQuotaDates({
          start_timestamp: windowStart,
          end_timestamp: nowSeconds(),
        })
      )
      return res.data ?? []
    },
    enabled: hasUsage,
    staleTime: 60 * 1000,
  })

  const topupInfo = useTopupInfo()

  const rules = usePayRules()

  const subscriptions = useSelfSubscriptions()

  const plans = useQuery({
    queryKey: walletKeys.plans,
    queryFn: async () => {
      const res = requireServerSuccess(await getPublicPlans())
      return (res.data ?? []).map((record) => record.plan)
    },
    staleTime: 5 * 60 * 1000,
  })

  return { self, usage, topupInfo, rules, subscriptions, plans }
}
