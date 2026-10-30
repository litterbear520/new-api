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
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { API_KEY_STATUS, API_KEY_STATUSES } from '@/features/keys/constants'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestamp, formatTimestampRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { BreakdownRow, UsageMetric } from '../../lib/usage-stats'

export type BreakdownKind = 'keys' | 'models' | 'users'

const SKELETON_ROWS = ['w-28', 'w-36', 'w-24'] as const

interface UsageBreakdownProps {
  kind: BreakdownKind
  rows: BreakdownRow[]
  metric: UsageMetric
  loading: boolean
  range: { start: Date; end: Date }
  format: Record<UsageMetric, (value: number) => string>
}

/**
 * The table under the chart: one row per key, model or user, largest first by
 * the chosen metric. A row opens the logs for that key/model/user and range.
 */
export function UsageBreakdown(props: UsageBreakdownProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const navigate = useNavigate()
  const total = props.rows.reduce((sum, row) => sum + row[props.metric], 0)
  const showLastUsed = props.kind === 'keys'
  const nameHeader = {
    keys: t('Key'),
    models: t('Model'),
    users: t('Username'),
  }[props.kind]

  const logsSearch = (row: BreakdownRow) => ({
    ...row.logs,
    startTime: props.range.start.getTime(),
    endTime: props.range.end.getTime(),
  })

  return (
    <Table className='[&_tbody>tr]:h-11'>
      <TableHeader>
        <TableRow className='hover:bg-transparent'>
          <TableHead className='ps-4 sm:ps-5'>{nameHeader}</TableHead>
          <TableHead className='text-right'>{t('Requests')}</TableHead>
          <TableHead className='text-right max-sm:hidden'>
            {t('Tokens')}
          </TableHead>
          <TableHead className='text-right'>{t('Spend')}</TableHead>
          <TableHead className='w-40 max-md:hidden'>{t('Share')}</TableHead>
          {showLastUsed && (
            <TableHead className='text-right max-lg:hidden'>
              {t('Last used')}
            </TableHead>
          )}
          <TableHead className='w-10 pe-3'>
            <span className='sr-only'>{t('View logs')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.loading
          ? SKELETON_ROWS.map((width) => (
              <TableRow key={width} className='hover:bg-transparent'>
                <TableCell className='ps-4 sm:ps-5'>
                  <Skeleton className={cn('h-4', width)} />
                </TableCell>
                <TableCell colSpan={showLastUsed ? 6 : 5}>
                  <Skeleton className='ms-auto h-4 w-40' />
                </TableCell>
              </TableRow>
            ))
          : props.rows.map((row) => {
              const share = total > 0 ? row[props.metric] / total : 0
              const status =
                row.status != null && row.status !== API_KEY_STATUS.ENABLED
                  ? API_KEY_STATUSES[row.status]
                  : undefined
              return (
                <TableRow
                  key={row.id}
                  className={cn(row.logs && 'cursor-pointer')}
                  onClick={(event) => {
                    if (!row.logs) return
                    // The name link handles its own click.
                    if ((event.target as Element).closest('a')) return
                    void navigate({
                      to: '/usage-logs/$section',
                      params: { section: 'common' },
                      search: logsSearch(row),
                    })
                  }}
                >
                  <TableCell className='ps-4 sm:ps-5'>
                    <div className='flex max-w-56 min-w-0 items-center gap-2'>
                      {row.family && (
                        <i
                          aria-hidden='true'
                          className={`bo-sw bo-fam-${row.family}`}
                        />
                      )}
                      {row.logs ? (
                        <Link
                          to='/usage-logs/$section'
                          params={{ section: 'common' }}
                          search={logsSearch(row)}
                          title={row.name}
                          className='truncate hover:underline'
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <span
                          title={row.name}
                          className='text-muted-foreground truncate'
                        >
                          {row.name}
                        </span>
                      )}
                      {status && (
                        <StatusBadge
                          label={t(status.label)}
                          variant={status.variant}
                          size='sm'
                          copyable={false}
                          className='text-xs!'
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className='text-right'>
                    {props.format.requests(row.requests)}
                  </TableCell>
                  <TableCell className='text-right max-sm:hidden'>
                    {props.format.tokens(row.tokens)}
                  </TableCell>
                  <TableCell className='text-right'>
                    {props.format.quota(row.quota)}
                  </TableCell>
                  <TableCell className='max-md:hidden'>
                    <div className='flex items-center gap-2'>
                      <div className='bg-muted h-1.5 w-24 overflow-hidden rounded-full'>
                        <div
                          className='bg-foreground/70 h-full rounded-full'
                          style={{ width: `${Math.round(share * 1000) / 10}%` }}
                        />
                      </div>
                      <span className='text-muted-foreground w-11 text-right text-xs!'>
                        {total > 0 ? `${(share * 100).toFixed(1)}%` : '–'}
                      </span>
                    </div>
                  </TableCell>
                  {showLastUsed && (
                    <TableCell className='text-muted-foreground text-right max-lg:hidden'>
                      {row.lastUsed ? (
                        <span title={formatTimestamp(row.lastUsed)}>
                          {formatTimestampRelative(
                            row.lastUsed,
                            'seconds',
                            locale
                          )}
                        </span>
                      ) : (
                        // null: a current key that never made a request;
                        // undefined: a deleted key, nothing to show.
                        row.lastUsed === null && t('Never used')
                      )}
                    </TableCell>
                  )}
                  <TableCell className='pe-3'>
                    {row.logs && (
                      <ChevronRight
                        aria-hidden='true'
                        className='text-muted-foreground size-4'
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
      </TableBody>
    </Table>
  )
}
