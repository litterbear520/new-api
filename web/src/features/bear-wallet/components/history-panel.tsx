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
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getUserBillingHistory } from '@/features/wallet/api'
import type { PaymentMethod, TopupRecord } from '@/features/wallet/types'
import { toIntlLocale } from '@/i18n/languages'
import { requireServerSuccess } from '@/lib/server-error-message'

import { HISTORY_PAGE_SIZE, walletKeys } from '../constants'
import { orderTime, usd } from '../lib/format'
import type { Pack } from '../lib/packs'
import { yuan } from '../lib/rules'
import { PacksList } from './packs-list'

const SKELETON_ROWS = ['w-24', 'w-32', 'w-20'] as const

function StatusCell(props: { status: TopupRecord['status'] }) {
  const { t } = useTranslation()
  let label = t('Closed')
  let variant: StatusVariant = 'neutral'
  if (props.status === 'success') {
    label = t('Credited')
    variant = 'success'
  } else if (props.status === 'pending') {
    label = t('Not paid')
    variant = 'warning'
  }
  return (
    <StatusBadge
      label={label}
      variant={variant}
      size='sm'
      copyable={false}
      className='text-xs!'
    />
  )
}

/**
 * 充值记录: packs with an expiry date, then the orders newest first, with the
 * order number to quote when asking for help.
 */
export function HistoryPanel(props: {
  methods: PaymentMethod[]
  isAdmin: boolean
  packs: Pack[]
  nowSeconds: number
  /** Scroll here once loaded (older links to the history tab) */
  focus?: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const queryClient = useQueryClient()
  const [pages, setPages] = useState(1)
  const sectionRef = useRef<HTMLElement>(null)
  const history = useQuery({
    queryKey: [...walletKeys.history, pages],
    queryFn: async () => {
      const res = requireServerSuccess(
        await getUserBillingHistory(1, HISTORY_PAGE_SIZE * pages)
      )
      return res.data ?? { items: [], total: 0 }
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })
  const methodName = (type: string) => {
    const listed = props.methods.find((item) => item.type === type)?.name
    if (listed) return listed
    if (type === 'alipay') return t('Alipay')
    if (type === 'wxpay') return t('WeChat Pay')
    return type
  }

  const items = history.data?.items ?? []
  const total = history.data?.total ?? 0

  useEffect(() => {
    if (props.focus && !history.isPending) {
      sectionRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [props.focus, history.isPending])

  let body
  if (history.isPending) {
    body = SKELETON_ROWS.map((width) => (
      <TableRow key={width} className='hover:bg-transparent'>
        <TableCell className='ps-4 sm:ps-5'>
          <Skeleton className={`h-4 ${width}`} />
        </TableCell>
        <TableCell colSpan={5}>
          <Skeleton className='ms-auto h-4 w-40' />
        </TableCell>
      </TableRow>
    ))
  } else if (history.isError && !history.data) {
    body = (
      <TableRow className='hover:bg-transparent'>
        <TableCell colSpan={6} className='p-0 whitespace-normal'>
          <ErrorState
            title={t('Failed to load')}
            // 累计充值 reads the same orders; retry it too.
            onRetry={() =>
              void queryClient.invalidateQueries({
                queryKey: walletKeys.history,
              })
            }
            className='min-h-0 py-10'
          />
        </TableCell>
      </TableRow>
    )
  } else if (!items.length) {
    body = (
      <TableRow className='hover:bg-transparent'>
        <TableCell
          colSpan={6}
          className='text-muted-foreground py-10 text-center'
        >
          {t('No top-ups yet.')}
        </TableCell>
      </TableRow>
    )
  } else {
    body = items.map((record) => (
      <TableRow key={record.id} className='hover:bg-transparent'>
        <TableCell className='ps-4 tabular-nums sm:ps-5'>
          {orderTime(record.create_time, locale)}
        </TableCell>
        <TableCell className='max-sm:hidden'>
          <code className='bw-trade max-w-56' title={record.trade_no}>
            {record.trade_no}
          </code>
        </TableCell>
        <TableCell className='text-right tabular-nums'>
          {yuan(record.money, locale)}
        </TableCell>
        <TableCell className='text-right tabular-nums'>
          {record.status === 'success' ? (
            `+${usd(record.amount, locale)}`
          ) : (
            <span className='text-muted-foreground'>–</span>
          )}
        </TableCell>
        <TableCell className='text-muted-foreground max-md:hidden'>
          {methodName(record.payment_method)}
        </TableCell>
        <TableCell className='pe-4 text-right sm:pe-5'>
          <StatusCell status={record.status} />
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <section
      ref={sectionRef}
      id='bw-history'
      aria-labelledby='bw-history-h'
      className='bg-card scroll-mt-4 overflow-hidden rounded-lg border'
    >
      <div className='flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-5'>
        <h2 id='bw-history-h' className='text-sm font-medium'>
          {t('Top-up history')}
        </h2>
        {props.isAdmin && (
          <Link
            to='/wallet/classic'
            className='text-muted-foreground hover:text-foreground ms-auto text-xs hover:underline'
          >
            {t('Classic wallet: all users’ orders and admin tools')}
          </Link>
        )}
      </div>
      <PacksList packs={props.packs} nowSeconds={props.nowSeconds} />
      <Table className='[&_tbody>tr]:h-11'>
        <TableHeader>
          <TableRow className='hover:bg-transparent'>
            <TableHead className='ps-4 sm:ps-5'>{t('Time')}</TableHead>
            <TableHead className='max-sm:hidden'>{t('Order number')}</TableHead>
            <TableHead className='text-right'>{t('Payment amount')}</TableHead>
            <TableHead className='text-right'>{t('Credited amount')}</TableHead>
            <TableHead className='max-md:hidden'>
              {t('Payment method')}
            </TableHead>
            <TableHead className='pe-4 text-right sm:pe-5'>
              {t('Status')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{body}</TableBody>
      </Table>
      {items.length < total && (
        <div className='border-t px-4 py-2.5 text-center sm:px-5'>
          <Button
            variant='ghost'
            size='sm'
            disabled={history.isFetching}
            onClick={() => setPages((n) => n + 1)}
          >
            {t('Show more')}
          </Button>
        </div>
      )}
    </section>
  )
}
