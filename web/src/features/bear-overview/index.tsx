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
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout'
import { useHeldCredit } from '@/features/bear-wallet/hooks/use-wallet-data'
import { PerformanceHealthPanel } from '@/features/dashboard/components/overview/performance-health-panel'
import { useApiInfo } from '@/features/dashboard/hooks/use-status-data'
import { useStatus } from '@/hooks/use-status'
import { ROLE } from '@/lib/roles'
import { getServerErrorMessage } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import type { ApiLine } from './components/access-panel'
import { AccessPopover } from './components/access-popover'
import { AccountQuotaCard } from './components/account-quota-card'
import { EmptyUsage } from './components/empty-usage'
import { KeyLimits } from './components/key-limits'
import { OverviewHeader } from './components/overview-header'
import { RunwayLine } from './components/runway'
import { StatCards } from './components/stat-cards'
import { UsageCard } from './components/usage-card'
import { WalletCard } from './components/wallet-card'
import {
  API_FORMATS,
  LOW_BALANCE_DAYS,
  STORAGE_KEYS,
  type ApiFormat,
} from './constants'
import {
  useAccountQuota,
  useRefreshAccountQuota,
  useResetAccountQuota,
} from './hooks/use-account-quota'
import { useOverviewData } from './hooks/use-overview-data'
import { useStoredState } from './hooks/use-stored-state'
import { createAccessHandle } from './lib/access'
import { keyRows, recentKey, spendByKey } from './lib/keys'
import { estimateRunOut, summarizeUsage } from './lib/usage'
import { walletGauge } from './lib/wallet'

import './bear-overview.css'

const FORMAT_IDS = API_FORMATS.map((item) => item.id)
const NO_USAGE: Parameters<typeof summarizeUsage>[0] = []

/**
 * The console home (「概览」), after OpenModel's dashboard: one column with
 * the page header (接入信息 popover, 充值), a stat row led by the wallet card,
 * daily usage by model family and key limits. A new account sees an empty
 * usage card with the first two steps; a low balance turns the wallet card
 * to dusk.
 */
export function BearOverview() {
  const { t } = useTranslation()
  const authUser = useAuthStore((state) => state.auth.user)
  const { status } = useStatus()
  const { items: apiInfo } = useApiInfo()
  const data = useOverviewData(authUser)
  // Bonus and gift packs are spent first, so they count as balance here too.
  const held = useHeldCredit()
  const [accessHandle] = useState(createAccessHandle)
  const [format, setFormat] = useStoredState<ApiFormat>(
    STORAGE_KEYS.format,
    'openai',
    FORMAT_IDS
  )
  const [savedLine, setLine] = useStoredState<string>(STORAGE_KEYS.line, '')

  const user = data.self.data ?? authUser
  const accountQuota = useAccountQuota(user?.group)
  const refreshQuota = useRefreshAccountQuota(user?.group)
  const resetQuota = useResetAccountQuota(user?.group)
  const now = new Date()
  const minute = Math.floor(now.getTime() / 60000)
  // A new account has no usage to fetch: its cards show zeros.
  const usageRows = data.isNew ? NO_USAGE : data.usage.data
  const summary = useMemo(
    () => (usageRows ? summarizeUsage(usageRows, new Date()) : null),
    // Recomputed each minute so "today" and the runway stay current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usageRows, minute]
  )
  // Without usage the stat cards and the chart give way to one error state;
  // the balance comes from /api/user/self and still shows.
  const usageFailed = !data.isNew && !summary && data.usage.isError

  const balance = Number(user?.quota ?? 0) + held
  const credit = balance + Number(user?.used_quota ?? 0)
  const perDay = summary?.perDayQuota ?? 0
  const runwayDays = perDay > 0 ? balance / perDay : null
  let kind: 'new' | 'low' | 'active' = 'active'
  if (data.isNew) kind = 'new'
  else if (
    balance <= 0 ||
    (runwayDays !== null && runwayDays < LOW_BALANCE_DAYS)
  ) {
    kind = 'low'
  }

  const lines = useMemo<ApiLine[]>(() => {
    const listed = apiInfo
      .filter((item) => item.url)
      .map((item) => ({
        url: item.url.trim().replace(/\/+$/, ''),
        route: item.route || item.url,
        description: item.description || '',
      }))
    if (listed.length) return listed
    const server =
      (typeof status?.server_address === 'string' &&
        status.server_address.trim()) ||
      window.location.origin
    return [
      {
        url: server.replace(/\/+$/, ''),
        route: t('Current domain'),
        description: '',
      },
    ]
  }, [apiInfo, status?.server_address, t])
  // Default to the line this page was opened on: it is known to work here.
  const line =
    lines.find((item) => item.url === savedLine)?.url ??
    lines.find((item) => item.url === window.location.origin)?.url ??
    lines[0]?.url ??
    ''

  const keys = useMemo(() => data.keys.data ?? [], [data.keys.data])
  const lastKey = recentKey(keys)
  const masked = lastKey ? `sk-${lastKey.key}` : null
  const rows = useMemo(
    () => keyRows(keys, spendByKey(data.keySpend.data ?? [])),
    [data.keySpend.data, keys]
  )
  const gauge = walletGauge({
    balance,
    usedQuota: Number(user?.used_quota ?? 0),
    lastTopUpAt: data.lastTopUp.data ?? null,
    spentSinceTopUp: data.spentSinceTopUp.data ?? null,
  })
  const runOut = summary
    ? estimateRunOut(balance, perDay, summary.hourShape, now)
    : null
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)
  const name = user?.display_name || user?.username || ''

  let walletSub = (
    <RunwayLine balance={balance} perDay={perDay} runOut={runOut} now={now} />
  )
  if (kind === 'new') walletSub = <>{t('No requests yet')}</>
  else if (usageFailed && balance > 0) {
    walletSub = <>{t('Spending pace unavailable')}</>
  }

  const refreshKeys = () => {
    void data.keys.refetch()
    void data.keySpend.refetch()
  }

  const wallet = (
    <WalletCard kind={kind} balance={balance} gauge={gauge} sub={walletSub} />
  )

  let stats: ReactNode
  if (summary) {
    stats = <StatCards summary={summary} now={now} wallet={wallet} />
  } else if (usageFailed) {
    stats = (
      <div className='bo-stats'>
        {wallet}
        <section className='bo-card bo-stats-error'>
          <ErrorState
            title={t('Failed to load usage')}
            description={getServerErrorMessage(data.usage.error)}
            onRetry={() => void data.usage.refetch()}
            className='min-h-0 p-6'
          />
        </section>
      </div>
    )
  } else {
    stats = (
      <div className='bo-stats' aria-busy='true'>
        {wallet}
        {[0, 1, 2].map((index) => (
          <div key={index} className='bo-card bo-c'>
            <span className='bo-skel h-4 w-20' />
            <span className='bo-skel mt-5 h-8 w-24' />
            <span className='bo-skel mt-2 h-4 w-36' />
          </div>
        ))}
      </div>
    )
  }

  return (
    <Main pageScroll className='p-0'>
      <div className='bo-page'>
        <div className='bo bo-one' data-kind={kind}>
          <OverviewHeader
            name={name}
            kind={kind}
            credit={credit}
            balance={balance}
            runwayDays={runwayDays}
            summary={summary}
            access={
              <AccessPopover
                handle={accessHandle}
                lines={lines}
                line={line}
                onLine={setLine}
                format={format}
                onFormat={setFormat}
                apiKey={
                  lastKey && masked
                    ? { id: lastKey.id, name: lastKey.name, masked }
                    : null
                }
              />
            }
          />

          {stats}

          {accountQuota.data && (
            <AccountQuotaCard
              quota={accountQuota.data}
              refreshing={refreshQuota.isPending}
              onRefresh={() =>
                refreshQuota.mutate(undefined, {
                  onError: () =>
                    toast.error(t("Can't read the quota right now.")),
                })
              }
              onReset={(id) => resetQuota.mutateAsync(id)}
            />
          )}

          {kind === 'new' ? (
            <EmptyUsage
              accessHandle={accessHandle}
              onKeysChange={() => void data.keys.refetch()}
            />
          ) : (
            <>
              {summary && <UsageCard summary={summary} now={now} />}
              <KeyLimits
                rows={rows}
                loading={data.keys.isLoading}
                updatedAt={data.keys.dataUpdatedAt}
                refreshing={data.keys.isFetching || data.keySpend.isFetching}
                onRefresh={refreshKeys}
              />
            </>
          )}

          {isAdmin && <PerformanceHealthPanel />}
        </div>
      </div>
    </Main>
  )
}
