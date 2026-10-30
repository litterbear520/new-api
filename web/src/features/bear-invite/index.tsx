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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { overviewKeys } from '@/features/bear-overview/hooks/use-overview-data'
import {
  usePayRules,
  useSelf,
  useTopupInfo,
} from '@/features/bear-wallet/hooks/use-wallet-data'
import { usd } from '@/features/bear-wallet/lib/format'
import { getUserLogs } from '@/features/usage-logs/api'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import { useAffiliate } from '@/features/wallet/hooks/use-affiliate'
import { toIntlLocale } from '@/i18n/languages'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { InviteRecords } from './components/invite-records'
import { InviteSummary, type TransferState } from './components/invite-summary'
import { inviteRecords } from './lib/records'

/** New API's system log type, where invite rewards are written */
const SYSTEM_LOG_TYPE = 4
const RECORDS_PAGE_SIZE = 100

const inviteKeys = {
  records: ['bear-invite', 'records'] as const,
}

/**
 * 邀请奖励, after OpenModel's referral page: the link and what it earns on
 * top, the reward history below. New API pays a fixed reward when a friend
 * signs up and keeps it apart until it is moved to the balance; the amounts
 * come from pay-bridge's rules, which repeat New API's settings.
 */
export function BearInvite() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const queryClient = useQueryClient()
  const authUser = useAuthStore((state) => state.auth.user)
  const self = useSelf()
  const user = self.data ?? authUser
  const rules = usePayRules()
  const invite = rules.data?.invite ?? null
  const { affiliateLink, loading, transferQuota, transferring } = useAffiliate()
  // Like the official wallet: moving rewards waits for the compliance terms.
  // Until the answer is in nothing moves; if it cannot load, New API itself
  // refuses with its reason.
  const topupInfo = useTopupInfo()
  let transfer: TransferState = 'open'
  if (topupInfo.isPending) transfer = 'waiting'
  else if (topupInfo.data?.payment_compliance_confirmed === false) {
    transfer = 'blocked'
  }

  const records = useQuery({
    queryKey: inviteKeys.records,
    queryFn: async () => {
      const res = requireServerSuccess(
        await getUserLogs({
          type: SYSTEM_LOG_TYPE,
          p: 1,
          page_size: RECORDS_PAGE_SIZE,
        })
      )
      return inviteRecords((res.data?.items ?? []) as UsageLog[])
    },
    staleTime: 30 * 1000,
  })

  const pending = Number(user?.aff_quota ?? 0)
  const move = async () => {
    if (await transferQuota(pending)) {
      void queryClient.invalidateQueries({ queryKey: overviewKeys.self })
    }
  }
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: overviewKeys.self })
    void queryClient.invalidateQueries({ queryKey: inviteKeys.records })
  }

  const description =
    invite && invite.inviter > 0 && invite.invitee > 0
      ? t(
          'When a friend signs up with your link, you get {{inviter}} and they get {{invitee}} extra.',
          {
            inviter: usd(invite.inviter, locale),
            invitee: usd(invite.invitee, locale),
          }
        )
      : t('When a friend signs up with your link, you both get a reward.')

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Invite rewards')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {description}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          <InviteSummary
            link={affiliateLink}
            loadingLink={loading}
            invite={invite}
            pending={pending}
            earned={Number(user?.aff_history_quota ?? 0)}
            invited={Number(user?.aff_count ?? 0)}
            transferring={transferring}
            transfer={transfer}
            onMove={move}
          />
          <InviteRecords
            records={records.data ?? []}
            loading={records.isPending}
            error={records.isError}
            onRetry={() => void records.refetch()}
            refreshing={records.isFetching}
            onRefresh={refresh}
            link={affiliateLink}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
