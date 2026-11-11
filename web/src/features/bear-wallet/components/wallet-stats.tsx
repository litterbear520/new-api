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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { money } from '@/features/bear-overview/lib/money'
import { getUserBillingHistory } from '@/features/wallet/api'
import type { TopupRecord } from '@/features/wallet/types'
import { toIntlLocale } from '@/i18n/languages'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { walletKeys } from '../constants'
import { monthDay } from '../lib/format'
import type { Pack } from '../lib/packs'
import { yuan } from '../lib/rules'

/**
 * Orders read to add up 近 30 天充值; nobody here has more. New API returns
 * only the last 30 days of a user's top-ups (topUpQueryWindowSeconds in
 * model/topup.go), so the figure cannot be an all-time total.
 */
const SUM_PAGE_SIZE = 100
const SUM_MAX_PAGES = 5

/** Yuan paid and orders credited, over the orders New API returns */
function sumPaid(records: TopupRecord[]): {
  paid: number
  count: number
} {
  let paid = 0
  let count = 0
  for (const record of records) {
    if (record.status !== 'success') continue
    paid += Number(record.money) || 0
    count += 1
  }
  return { paid: Math.round(paid * 100) / 100, count }
}

function Figure(props: {
  label: string
  value: ReactNode
  sub?: ReactNode
  loading?: boolean
  tone?: 'low'
}) {
  return (
    <div className='min-w-0 border-s px-3 py-3 first:border-s-0 sm:px-5 sm:py-4'>
      <div className='text-muted-foreground truncate text-xs sm:text-sm'>
        {props.label}
      </div>
      <div
        className={cn(
          'mt-1 truncate text-lg font-semibold tabular-nums sm:text-2xl',
          props.tone === 'low' && 'text-destructive'
        )}
      >
        {props.loading ? (
          <Skeleton className='h-6 w-20 sm:h-8 sm:w-28' />
        ) : (
          props.value
        )}
      </div>
      <div className='text-muted-foreground mt-0.5 min-h-4 text-xs max-sm:hidden'>
        {props.sub}
      </div>
    </div>
  )
}

/** 可用额度 · 限时额度 · 近 30 天充值 */
export function WalletStats(props: {
  total: number | null
  low: boolean
  /** What to say under a low balance (the overview's runway line) */
  runway: ReactNode
  held: number
  packs: Pack[]
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const paid = useQuery({
    queryKey: [...walletKeys.history, 'sum'],
    queryFn: async () => {
      const records: TopupRecord[] = []
      for (let page = 1; page <= SUM_MAX_PAGES; page++) {
        const res = requireServerSuccess(
          await getUserBillingHistory(page, SUM_PAGE_SIZE)
        )
        const items = res.data?.items ?? []
        records.push(...items)
        if (items.length < SUM_PAGE_SIZE) break
        if (records.length >= (res.data?.total ?? 0)) break
      }
      return sumPaid(records)
    },
    staleTime: 30 * 1000,
  })

  let totalSub: ReactNode = null
  if (props.low) totalSub = props.runway
  else if (props.held > 0) {
    totalSub = t('Includes {{amount}} with an expiry date', {
      amount: money(props.held, locale),
    })
  }
  const soonest = props.packs[0]

  let paidSub: ReactNode = null
  if (paid.data) {
    paidSub = t('Paid top-ups: {{count}}', { count: paid.data.count })
  } else if (paid.isError) {
    paidSub = (
      <span className='inline-flex items-center gap-1.5'>
        {t('Failed to load')}
        <Button
          variant='link'
          size='xs'
          className='h-auto p-0'
          disabled={paid.isFetching}
          onClick={() => void paid.refetch()}
        >
          {t('Retry')}
        </Button>
      </span>
    )
  }

  return (
    <section
      aria-label={t('Wallet')}
      className='bg-card grid grid-cols-3 overflow-hidden rounded-lg border'
    >
      <Figure
        label={t('Available credit')}
        value={props.total === null ? null : money(props.total, locale)}
        loading={props.total === null}
        sub={totalSub}
        tone={props.low ? 'low' : undefined}
      />
      <Figure
        label={t('Credit with an expiry date')}
        value={money(props.held, locale)}
        sub={
          soonest
            ? t('{{amount}} expires on {{date}}', {
                amount: money(soonest.left, locale),
                date: monthDay(soonest.endsAt, locale),
              })
            : t('Top-up bonuses land here')
        }
      />
      <Figure
        label={t('Topped up, last 30 days')}
        value={paid.data ? yuan(paid.data.paid, locale) : '–'}
        loading={paid.isPending}
        sub={paidSub}
      />
    </section>
  )
}
