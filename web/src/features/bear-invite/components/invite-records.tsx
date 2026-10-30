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
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { ErrorState } from '@/components/error-state'
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
import { orderTime, usd } from '@/features/bear-wallet/lib/format'
import { toIntlLocale } from '@/i18n/languages'
import { cn } from '@/lib/utils'

import type { InviteRecord } from '../lib/records'

const SKELETON_ROWS = ['w-28', 'w-36', 'w-24'] as const
// Widths (%) of the grey placeholder rows in the empty state
const SKETCH = [
  [30, 26, 18, 14],
  [34, 22, 16, 16],
].map((row, line) => ({
  id: `line-${line}`,
  // Widths repeat within a row, so each bar keeps its place as its key.
  bars: row.map((width, place) => ({ id: `bar-${place}`, width })),
}))

/** 奖励记录: one row per friend who signed up with the link */
export function InviteRecords(props: {
  records: InviteRecord[]
  loading: boolean
  /** The history could not be read; not the same as no invites */
  error: boolean
  onRetry: () => void
  refreshing: boolean
  onRefresh: () => void
  /** The invite link, empty until it has loaded */
  link: string
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  let body
  if (props.loading) {
    body = (
      <Table className='[&_tbody>tr]:h-11'>
        <TableBody>
          {SKELETON_ROWS.map((width) => (
            <TableRow key={width} className='hover:bg-transparent'>
              <TableCell className='ps-4 sm:ps-5'>
                <Skeleton className={cn('h-4', width)} />
              </TableCell>
              <TableCell>
                <Skeleton className='ms-auto h-4 w-16' />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  } else if (props.error) {
    body = (
      <ErrorState
        title={t('Failed to load')}
        onRetry={props.onRetry}
        className='min-h-0 py-12'
      />
    )
  } else if (!props.records.length) {
    // Hand-built, not EmptyState: EmptyState takes only a Lucide icon and has
    // no slot for this placeholder-row drawing.
    body = (
      <div className='flex flex-col items-center gap-1.5 px-4 py-12 text-center'>
        <div aria-hidden='true' className='mb-4 flex w-40 flex-col gap-2.5'>
          <span className='bg-muted-foreground/20 h-2.5 rounded-full' />
          {SKETCH.map((row) => (
            <span key={row.id} className='flex gap-2'>
              {row.bars.map((bar) => (
                <span
                  key={bar.id}
                  className='bg-muted-foreground/10 h-2 rounded-full'
                  style={{ width: `${bar.width}%` }}
                />
              ))}
            </span>
          ))}
        </div>
        <p className='text-sm font-medium'>{t('No invites yet')}</p>
        <p className='text-muted-foreground text-sm'>
          {t(
            'When a friend signs up with your link, the reward shows up here.'
          )}
        </p>
        {props.link && (
          <CopyButton
            value={props.link}
            variant='outline'
            size='sm'
            className='mt-3'
            aria-label={t('Copy invite link')}
          >
            {t('Copy invite link')}
          </CopyButton>
        )}
      </div>
    )
  } else {
    body = (
      <Table className='[&_tbody>tr]:h-11'>
        <TableHeader>
          <TableRow className='hover:bg-transparent'>
            <TableHead className='ps-4 sm:ps-5'>{t('Time')}</TableHead>
            <TableHead>{t('Event')}</TableHead>
            <TableHead className='pe-4 text-right sm:pe-5'>
              {t('Reward')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.records.map((record) => (
            <TableRow key={record.id} className='hover:bg-transparent'>
              <TableCell className='ps-4 tabular-nums sm:ps-5'>
                {orderTime(record.createdAt, locale)}
              </TableCell>
              <TableCell>{t('A friend signed up')}</TableCell>
              <TableCell className='pe-4 text-right font-medium tabular-nums sm:pe-5'>
                {record.usd !== null
                  ? `+${usd(record.usd, locale)}`
                  : record.raw}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <section
      aria-labelledby='invite-records-h'
      className='bg-card overflow-hidden rounded-lg border'
    >
      <div className='flex items-center gap-2 border-b px-4 py-2.5 sm:px-5'>
        <h2 id='invite-records-h' className='text-sm font-medium'>
          {t('Reward history')}
        </h2>
        <Button
          variant='ghost'
          size='icon-sm'
          className='ms-auto'
          aria-label={t('Refresh')}
          disabled={props.refreshing}
          onClick={props.onRefresh}
        >
          <RefreshCw
            aria-hidden='true'
            className={cn(props.refreshing && 'animate-spin')}
          />
        </Button>
      </div>
      {body}
    </section>
  )
}
