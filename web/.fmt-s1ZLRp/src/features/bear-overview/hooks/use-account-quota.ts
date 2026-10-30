import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

import {
  ACCOUNT_QUOTA_RESET_URL,
  ACCOUNT_QUOTA_URL,
  parseAccountQuota,
  parseResetReply,
  type ResetResult,
} from '../lib/account-quota'
import { overviewKeys } from './use-overview-data'

const quotaKey = (group: string | undefined) =>
  [...overviewKeys.all, 'account-quota', group] as const

/**
 * 专属号额度 for a user in their own group; default-group users never ask.
 * A refused token here must not sign anyone out, so it skips the auth
 * refresh and the error toast and simply shows nothing.
 */
export function useAccountQuota(group: string | undefined) {
  return useQuery({
    queryKey: quotaKey(group),
    queryFn: async () => {
      const res = await api.get(ACCOUNT_QUOTA_URL, {
        skipErrorHandler: true,
        skipAuthRefresh: true,
      })
      return parseAccountQuota(res.data)
    },
    enabled: Boolean(group) && group !== 'default',
    staleTime: 60 * 1000,
    retry: 1,
  })
}

/**
 * 用一张重置卡. Resolves to what happened and puts the numbers pay-bridge read
 * afterwards into the card. A refusal before pay-bridge acted (a 4xx, or 502
 * when it couldn't read the account) spent nothing; any other failure may have
 * reached the upstream, so it is unknown.
 */
export function useResetAccountQuota(group: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string): Promise<ResetResult> => {
      let reply
      try {
        const res = await api.post(
          ACCOUNT_QUOTA_RESET_URL,
          { request_id: requestId },
          { skipErrorHandler: true, skipAuthRefresh: true }
        )
        reply = parseResetReply(res.data)
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response
          ?.status
        const before = status === 502 || (status !== undefined && status < 500)
        return before ? 'unavailable' : 'unknown'
      }
      if (reply.quota) queryClient.setQueryData(quotaKey(group), reply.quota)
      return reply.result
    },
  })
}
