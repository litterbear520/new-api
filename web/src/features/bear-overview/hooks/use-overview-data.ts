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

import { getFlowQuotaDates, getUserQuotaDates } from '@/features/dashboard/api'
import { getApiKeys } from '@/features/keys/api'
import { getUserLogStats, getUserLogs } from '@/features/usage-logs/api'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import { useStatus } from '@/hooks/use-status'
import { getSelf } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import type { AuthUser } from '@/stores/auth-store'

import { usageWindowStart } from '../lib/usage'

/** Log type numbers from the backend (model/log.go) */
const LOG_TOPUP = 1
const LOG_CONSUME = 2

const nowSeconds = () => Math.floor(Date.now() / 1000)
const DAY_SECONDS = 86400

/**
 * Keeps a log query inside the admin's 日志最长查询天数 (log_max_range_days),
 * which the backend enforces on /api/data/self and /api/data/flow/self.
 */
function clampStart(start: number, end: number, maxDays: number): number {
  return maxDays > 0 ? Math.max(start, end - maxDays * DAY_SECONDS) : start
}

export const overviewKeys = {
  all: ['bear-overview'] as const,
  self: ['bear-overview', 'self'] as const,
}

/**
 * Everything the overview reads, each as its own cached query. `known` is the
 * signed-in user from the auth store, used until /api/user/self answers.
 */
export function useOverviewData(known: AuthUser | null) {
  const self = useQuery({
    queryKey: overviewKeys.self,
    queryFn: async () => {
      const res = requireServerSuccess(await getSelf())
      return (res.data ?? null) as AuthUser | null
    },
    staleTime: 30 * 1000,
  })
  const { status, loading: statusLoading } = useStatus()
  const maxDays = Number(status?.log_max_range_days) || 0
  // Wait for the status so the first read already knows the range limit.
  const rangeKnown = !statusLoading
  const user = self.data ?? known
  const isNew = user ? Number(user.request_count ?? 0) === 0 : false
  const hasUsage = Boolean(user) && !isNew

  // The window starts at a local midnight, so the key holds for the day.
  const windowStart = usageWindowStart(new Date())
  const usage = useQuery({
    queryKey: [...overviewKeys.all, 'usage', windowStart, maxDays],
    queryFn: async () => {
      const end = nowSeconds()
      const res = requireServerSuccess(
        await getUserQuotaDates({
          start_timestamp: clampStart(windowStart, end, maxDays),
          end_timestamp: end,
        })
      )
      return res.data ?? []
    },
    enabled: hasUsage && rangeKnown,
    staleTime: 60 * 1000,
  })

  const keys = useQuery({
    queryKey: [...overviewKeys.all, 'keys'],
    queryFn: async () => {
      const res = requireServerSuccess(await getApiKeys({ p: 1, size: 100 }))
      return res.data?.items ?? []
    },
    staleTime: 60 * 1000,
  })

  const keySpend = useQuery({
    queryKey: [...overviewKeys.all, 'key-spend', maxDays],
    queryFn: async () => {
      const end = nowSeconds()
      const res = requireServerSuccess(
        await getFlowQuotaDates({
          start_timestamp: clampStart(end - 30 * DAY_SECONDS, end, maxDays),
          end_timestamp: end,
        })
      )
      return res.data ?? []
    },
    enabled: hasUsage && rangeKnown,
    staleTime: 60 * 1000,
  })

  const lastTopUp = useQuery({
    queryKey: [...overviewKeys.all, 'last-topup'],
    queryFn: async () => {
      const res = requireServerSuccess(
        await getUserLogs({ p: 1, page_size: 1, type: LOG_TOPUP })
      )
      const item = res.data?.items?.[0] as UsageLog | undefined
      return item?.created_at ?? null
    },
    enabled: hasUsage,
    staleTime: 5 * 60 * 1000,
  })

  const topUpAt = lastTopUp.data ?? null
  const spentSinceTopUp = useQuery({
    queryKey: [...overviewKeys.all, 'spent-since', topUpAt],
    queryFn: async () => {
      const res = requireServerSuccess(
        await getUserLogStats({
          type: LOG_CONSUME,
          start_timestamp: topUpAt ?? 0,
          end_timestamp: nowSeconds(),
        })
      )
      return Number(res.data?.quota ?? 0)
    },
    enabled: hasUsage && topUpAt != null,
    staleTime: 60 * 1000,
  })

  return {
    self,
    usage,
    keys,
    keySpend,
    lastTopUp,
    spentSinceTopUp,
    isNew,
  }
}
