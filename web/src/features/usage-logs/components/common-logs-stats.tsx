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
import { getRouteApi } from '@tanstack/react-router'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'
import { formatLogQuota, formatNumber } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getLogStats, getUserLogStats } from '../api'
import { DEFAULT_LOG_STATS } from '../constants'
import { buildApiParams } from '../lib/utils'
import { useLogsViewScope, useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

/**
 * One line of totals for the current filters: what they cost and how many
 * logs match. Administrators also get the live RPM and TPM.
 */
export function CommonLogsStats(props: { total?: number }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { isAdminView: isAdmin } = useLogsViewScope()
  const searchParams = route.useSearch()
  const { sensitiveVisible } = useUsageLogsContext()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['usage-logs-stats', isAdmin, searchParams],
    queryFn: async () => {
      const params = buildApiParams({
        page: 1,
        pageSize: 1,
        searchParams,
        columnFilters: [],
        isAdmin,
      })

      const result = isAdmin
        ? requireServerSuccess(await getLogStats(params))
        : requireServerSuccess(await getUserLogStats(params))

      return result.success
        ? result.data || DEFAULT_LOG_STATS
        : DEFAULT_LOG_STATS
    },
    placeholderData: (previousData) => previousData,
  })

  if (isLoading) {
    return <Skeleton className='h-4 w-32 rounded' />
  }

  const parts = [
    t('Spent {{amount}}', {
      amount: sensitiveVisible ? formatLogQuota(stats?.quota || 0) : '••••',
    }),
    props.total != null
      ? t('Records: {{count}}', { count: formatNumber(props.total, locale) })
      : null,
    isAdmin ? `RPM ${formatNumber(stats?.rpm || 0, locale)}` : null,
    isAdmin ? `TPM ${formatNumber(stats?.tpm || 0, locale)}` : null,
  ].filter((part): part is string => Boolean(part))

  // Phones wrap the line between parts so RPM and TPM stay readable; from
  // sm up it stays one truncated line beside the filters.
  return (
    <p className='text-muted-foreground me-auto min-w-0 text-sm tabular-nums sm:me-1 sm:truncate'>
      {parts.map((part, index) => (
        <Fragment key={part}>
          {index > 0 && ' · '}
          <span className='whitespace-nowrap'>{part}</span>
        </Fragment>
      ))}
    </p>
  )
}
