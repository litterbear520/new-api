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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import '@/features/bear-overview/bear-overview.css'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Segmented } from '@/features/bear-overview/components/segmented'
import {
  UsageChart,
  type ChartDay,
} from '@/features/bear-overview/components/usage-chart'
import {
  FAMILY_LABELS,
  type FamilyKey,
} from '@/features/bear-overview/constants'
import { useStoredState } from '@/features/bear-overview/hooks/use-stored-state'
import {
  axisMoney,
  money,
  quotaPerUnit,
} from '@/features/bear-overview/lib/money'
import { getApiKeys } from '@/features/keys/api'
import { LogsTimeRangePicker } from '@/features/usage-logs/components/logs-time-range-picker'
import {
  LogsRefreshButton,
  LogsSearchInput,
  LogsToolbar,
} from '@/features/usage-logs/components/logs-toolbar-parts'
import { presetRange } from '@/features/usage-logs/lib/time-range'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { formatCompactNumber, formatNumber } from '@/lib/format'
import {
  getServerErrorMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import {
  getFlowQuotaDates,
  getUserQuotaDataByUsers,
  getUserQuotaDates,
} from '../../api'
import {
  bucketUsage,
  type SlotUnit,
  slotFamilies,
  slotUnit,
  sortBreakdown,
  sumUsage,
  USAGE_METRICS,
  usageBy,
  usageByKey,
  type UsageMetric,
} from '../../lib/usage-stats'
import { UsageBreakdown, type BreakdownKind } from './usage-breakdown'

const QUERY_KEY = 'usage-stats'
const CHART_HEIGHT = 200
const METRIC_STORAGE_KEY = 'usage-stats.metric'
const METRIC_LABELS: Record<UsageMetric, string> = {
  quota: 'Spend',
  requests: 'Requests',
  tokens: 'Tokens',
}

/** Axis top when nothing was used; spend uses one dollar instead. */
const EMPTY_AXIS_MAX: Record<UsageMetric, number> = {
  quota: 0,
  requests: 10,
  tokens: 1000,
}

/** Label every n-th slot so the axis keeps about eight labels. */
function tickEvery(unit: SlotUnit, slots: number): number {
  if (unit === 'hour') return slots > 24 ? 6 : 3
  return Math.max(1, Math.ceil(slots / 8))
}

const unix = (date: Date) => Math.floor(date.getTime() / 1000)

/**
 * 「用量统计」: one toolbar, three figures that double as the metric switch,
 * a stacked bar chart by model family, and a table by key or model (by model
 * or user for admins, who see the whole site).
 */
export function UsageStats(props: { isAdmin: boolean }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [range, setRange] = useState(() => presetRange('7d'))
  const [metric, setMetric] = useStoredState<UsageMetric>(
    METRIC_STORAGE_KEY,
    'quota',
    USAGE_METRICS
  )
  const [kind, setKind] = useState<BreakdownKind>(
    props.isAdmin ? 'models' : 'keys'
  )
  const [username, setUsername] = useState('')
  const start = unix(range.start)
  const end = unix(range.end)

  const usage = useQuery({
    queryKey: [QUERY_KEY, 'data', props.isAdmin, start, end, username],
    queryFn: async () =>
      requireServerSuccess(
        await getUserQuotaDates(
          {
            start_timestamp: start,
            end_timestamp: end,
            ...(username ? { username } : {}),
          },
          props.isAdmin
        )
      ).data ?? [],
  })
  const keyUsage = useQuery({
    queryKey: [QUERY_KEY, 'keys', start, end],
    enabled: !props.isAdmin,
    queryFn: async () => {
      const [flow, keys] = await Promise.all([
        getFlowQuotaDates({ start_timestamp: start, end_timestamp: end }),
        getApiKeys({ p: 1, size: 100 }),
      ])
      return {
        flow: requireServerSuccess(flow).data ?? [],
        keys: requireServerSuccess(keys).data?.items ?? [],
      }
    },
  })
  const userUsage = useQuery({
    queryKey: [QUERY_KEY, 'users', start, end],
    enabled: props.isAdmin && kind === 'users',
    queryFn: async () =>
      requireServerSuccess(
        await getUserQuotaDataByUsers({
          start_timestamp: start,
          end_timestamp: end,
        })
      ).data ?? [],
  })

  const rows = usage.data
  const unit = slotUnit(range.start, range.end)
  const slots = useMemo(
    () => bucketUsage(rows ?? [], range.start, range.end, unit),
    [rows, range, unit]
  )
  const totals = useMemo(() => sumUsage(rows ?? []), [rows])
  const families: FamilyKey[] = useMemo(() => {
    const found = slotFamilies(slots)
    return found.length ? found : ['gpt']
  }, [slots])

  const format: Record<UsageMetric, (value: number) => string> = useMemo(
    () => ({
      // Under a cent, two decimals would read $0.00.
      quota: (value) =>
        value > 0 && value < quotaPerUnit() / 100
          ? formatQuotaWithCurrency(value, {
              digitsLarge: 2,
              digitsSmall: 4,
              abbreviate: false,
              locale,
            })
          : money(value, locale),
      requests: (value) => formatNumber(value, locale),
      tokens: (value) => formatCompactNumber(value, locale),
    }),
    [locale]
  )

  const chartDays = useMemo<ChartDay[]>(() => {
    const now = Date.now()
    const hourly = unit === 'hour'
    const title = new Intl.DateTimeFormat(locale, {
      month: 'long',
      day: 'numeric',
      ...(hourly
        ? { hour: '2-digit', minute: '2-digit' }
        : { weekday: 'short' }),
    })
    const tick = new Intl.DateTimeFormat(
      locale,
      hourly
        ? { hour: '2-digit', minute: '2-digit' }
        : { month: 'numeric', day: 'numeric' }
    )
    const every = tickEvery(unit, slots.length)
    const span = hourly ? 3600_000 : 86400_000
    return slots.map((slot, index) => {
      const date = new Date(slot.start * 1000)
      const current = now >= date.getTime() && now < date.getTime() + span
      return {
        label: title.format(date),
        tick: index % every === 0 ? tick.format(date) : '',
        today: current,
        values: slot.values[metric],
      }
    })
  }, [locale, metric, slots, unit])

  const breakdown = useMemo(() => {
    if (kind === 'models') return usageBy('model', rows ?? [])
    if (kind === 'users') {
      const users = usageBy('user', userUsage.data ?? [])
      return username ? users.filter((row) => row.name === username) : users
    }
    return usageByKey(keyUsage.data?.flow ?? [], keyUsage.data?.keys ?? [], {
      deleted: (id) => t('Deleted ({{id}})', { id }),
      unknown: t('Unknown key'),
    })
  }, [kind, keyUsage.data, rows, t, userUsage.data, username])
  const breakdownQuery = { models: usage, keys: keyUsage, users: userUsage }[
    kind
  ]
  const breakdownLoading = breakdownQuery.isLoading

  const days = Math.max(
    1,
    Math.round((range.end.getTime() - range.start.getTime()) / 86400_000)
  )
  const subs: Record<UsageMetric, string> = {
    quota:
      totals.requests > 0
        ? t('{{value}} per request on average', {
            value: formatQuotaWithCurrency(totals.quota / totals.requests, {
              digitsLarge: 2,
              digitsSmall: 3,
              abbreviate: false,
              locale,
            }),
          })
        : '',
    requests:
      days > 1 && totals.requests > 0
        ? t('{{value}} a day on average', {
            value: formatNumber(Math.round(totals.requests / days), locale),
          })
        : '',
    tokens:
      totals.requests > 0
        ? t('{{value}} per request on average', {
            value: format.tokens(Math.round(totals.tokens / totals.requests)),
          })
        : '',
  }
  const empty = !usage.isLoading && !usage.isError && totals.requests === 0
  const canWiden = days < 29
  const kindOptions: ReadonlyArray<{ value: BreakdownKind; label: string }> =
    props.isAdmin
      ? [
          { value: 'models', label: t('By model') },
          { value: 'users', label: t('By user') },
        ]
      : [
          { value: 'keys', label: t('By key') },
          { value: 'models', label: t('By model') },
        ]

  // A failed load has no totals: a dash, not $0 (the chart says why).
  const figure = (key: UsageMetric): React.ReactNode => {
    if (usage.isLoading) {
      return <Skeleton className='h-6 w-20 sm:h-8 sm:w-28' />
    }
    if (usage.isError) return '—'
    return format[key](totals[key])
  }

  let table: React.ReactNode
  if (breakdownQuery.isError) {
    table = (
      <ErrorState
        title={t('Failed to load')}
        description={getServerErrorMessage(breakdownQuery.error)}
        onRetry={() => void breakdownQuery.refetch()}
        className='min-h-0 px-5 py-10'
      />
    )
  } else if (!breakdownLoading && breakdown.length === 0) {
    table = (
      <p className='text-muted-foreground px-5 py-10 text-center text-sm'>
        {t('No usage in this range')}
      </p>
    )
  } else {
    table = (
      <UsageBreakdown
        kind={kind}
        rows={sortBreakdown(breakdown, metric)}
        metric={metric}
        loading={breakdownLoading}
        range={range}
        format={format}
      />
    )
  }

  let chart: React.ReactNode
  if (usage.isLoading) {
    chart = <Skeleton className='w-full' style={{ height: CHART_HEIGHT }} />
  } else if (usage.isError) {
    chart = (
      <div
        className='flex flex-col justify-center'
        style={{ height: CHART_HEIGHT }}
      >
        <ErrorState
          title={t('Failed to load')}
          description={getServerErrorMessage(usage.error)}
          onRetry={() => void usage.refetch()}
          className='min-h-0 p-0'
        />
      </div>
    )
  } else {
    chart = (
      <UsageChart
        days={chartDays}
        families={families}
        barWidth={32}
        height={CHART_HEIGHT}
        emptyMax={metric === 'quota' ? quotaPerUnit() : EMPTY_AXIS_MAX[metric]}
        format={format[metric]}
        axisFormat={(value) =>
          metric === 'quota'
            ? axisMoney(value, locale)
            : formatCompactNumber(value, locale)
        }
      />
    )
  }

  return (
    <div className='bo-vars flex flex-col gap-2.5 sm:gap-4'>
      <section className='flex flex-col gap-2.5 sm:gap-0 sm:overflow-hidden sm:rounded-lg sm:border'>
        <LogsToolbar>
          <LogsTimeRangePicker
            start={range.start}
            end={range.end}
            onChange={setRange}
          />
          {props.isAdmin && (
            <LogsSearchInput
              value={username}
              onApply={setUsername}
              placeholder={t('Filter by username')}
              label={t('Username')}
              className='w-full max-sm:order-1 sm:w-48'
            />
          )}
          <div className='ms-auto flex items-center'>
            <LogsRefreshButton queryKeys={[[QUERY_KEY]]} />
          </div>
        </LogsToolbar>
        <div className='bg-card overflow-hidden rounded-lg border sm:rounded-none sm:border-0'>
          <div
            role='group'
            aria-label={t('Metric')}
            className='grid grid-cols-3 border-b'
          >
            {USAGE_METRICS.map((key) => (
              <button
                key={key}
                type='button'
                aria-pressed={metric === key}
                onClick={() => setMetric(key)}
                className={cn(
                  'relative min-w-0 border-e px-3 py-3 text-start transition-colors last:border-e-0 sm:px-5 sm:py-4',
                  'hover:bg-muted/40 focus-visible:bg-muted/60 outline-none',
                  'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-transparent',
                  metric === key && 'after:bg-foreground'
                )}
              >
                <div
                  className={cn(
                    'text-xs sm:text-sm',
                    metric === key
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground'
                  )}
                >
                  {t(METRIC_LABELS[key])}
                </div>
                <div className='mt-1 truncate text-lg font-semibold tabular-nums sm:text-2xl'>
                  {figure(key)}
                </div>
                <div className='text-muted-foreground mt-0.5 h-4 truncate text-xs tabular-nums max-sm:hidden'>
                  {usage.isLoading || usage.isError ? '' : subs[key]}
                </div>
              </button>
            ))}
          </div>
          <div className='px-3 pt-3 pb-2 sm:px-5 sm:pt-4'>
            <div className='mb-3 flex flex-wrap items-center gap-x-4 gap-y-1'>
              <p className='text-muted-foreground text-xs'>
                {unit === 'hour'
                  ? t('Per hour, by model family')
                  : t('Per day, by model family')}
              </p>
              {!empty && !usage.isError && (
                <ul
                  aria-hidden='true'
                  className='text-muted-foreground ms-auto flex flex-wrap gap-x-3 gap-y-1 text-xs'
                >
                  {[...families].reverse().map((key) => (
                    <li key={key} className='inline-flex items-center gap-1.5'>
                      <i className={`bo-sw bo-fam-${key}`} />
                      {t(FAMILY_LABELS[key])}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className='relative'>
              {chart}
              {empty && (
                <div className='absolute inset-0 flex flex-col items-center justify-center gap-2 pb-6 text-center'>
                  <p className='text-sm font-medium'>
                    {t('No usage in this range')}
                  </p>
                  {canWiden && (
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setRange(presetRange('30d'))}
                    >
                      {t('Show last 30 days')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className='bg-card overflow-hidden rounded-lg border'>
        <div className='flex flex-wrap items-center gap-2 border-b px-3 py-2.5 sm:px-5'>
          <Segmented
            label={t('Group by')}
            value={kind}
            onChange={setKind}
            options={kindOptions}
          />
          <p className='text-muted-foreground ms-auto text-xs max-sm:hidden'>
            {t('Sorted by {{metric}}. Click a row to see its logs.', {
              metric: t(METRIC_LABELS[metric]),
            })}
          </p>
        </div>
        {table}
      </section>
    </div>
  )
}
