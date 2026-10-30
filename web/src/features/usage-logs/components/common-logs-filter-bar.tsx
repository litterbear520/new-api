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
import type { Table } from '@tanstack/react-table'
import { Eye, EyeOff, SlidersHorizontal } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableViewOptions } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getGroups } from '@/features/users/api'
import { getUserGroups } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { LOG_TYPE_ALL_VALUE, LOG_TYPE_FILTERS } from '../constants'
import { isImeKeyEvent } from '../lib/ime'
import { getDefaultTimeRange } from '../lib/utils'
import { CommonLogsStats } from './common-logs-stats'
import { ExportLogsDialog } from './dialogs/export-logs-dialog'
import { LogsKeyFilter } from './logs-key-filter'
import { LogsTimeRangePicker } from './logs-time-range-picker'
import {
  LogsRefreshButton,
  LogsSearchInput,
  LogsToolbar,
} from './logs-toolbar-parts'
import { useLogsViewScope, useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

type LogsSearch = ReturnType<typeof route.useSearch>
type LogTypeValue = (typeof LOG_TYPE_FILTERS)[number]['value']

const logTypeValueSet = new Set<string>(
  LOG_TYPE_FILTERS.map((type) => type.value)
)

function isLogTypeValue(value: string): value is LogTypeValue {
  return logTypeValueSet.has(value)
}

function getLogTypeValue(value: unknown): LogTypeValue {
  return Array.isArray(value) &&
    value.length === 1 &&
    typeof value[0] === 'string' &&
    isLogTypeValue(value[0])
    ? value[0]
    : LOG_TYPE_ALL_VALUE
}

/** The filters behind 「更多筛选」; they apply together on 「应用」. */
type MoreFilters = {
  type: LogTypeValue
  group: string
  requestId: string
  upstreamRequestId: string
  username: string
  channel: string
}

function moreFiltersOf(search: LogsSearch): MoreFilters {
  return {
    type: getLogTypeValue(search.type),
    group: search.group ?? '',
    requestId: search.requestId ?? '',
    upstreamRequestId: search.upstreamRequestId ?? '',
    username: search.username ?? '',
    channel: search.channel ?? '',
  }
}

interface CommonLogsFilterBarProps<TData> {
  table: Table<TData>
  /** Number of logs that match the filters, from the list response. */
  total?: number
}

/**
 * One-row toolbar of the common logs: every control applies at once, except
 * the fields behind 「更多筛选」, which apply together.
 */
export function CommonLogsFilterBar<TData>(
  props: CommonLogsFilterBarProps<TData>
) {
  const { t } = useTranslation()
  const navigate = route.useNavigate()
  const searchParams = route.useSearch()
  const { isAdminView: isAdmin } = useLogsViewScope()
  const { sensitiveVisible, setSensitiveVisible } = useUsageLogsContext()

  const apply = useCallback(
    (patch: Partial<LogsSearch>) => {
      void navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) })
    },
    [navigate]
  )

  // Time range
  const defaultRange = useMemo(() => getDefaultTimeRange(), [])
  const start = searchParams.startTime
    ? new Date(searchParams.startTime)
    : defaultRange.start
  const end = searchParams.endTime
    ? new Date(searchParams.endTime)
    : defaultRange.end

  // More filters
  const [moreOpen, setMoreOpen] = useState(false)
  const [more, setMore] = useState<MoreFilters>(() =>
    moreFiltersOf(searchParams)
  )
  const appliedMore = moreFiltersOf(searchParams)
  const moreCount = [
    appliedMore.type !== LOG_TYPE_ALL_VALUE,
    appliedMore.group,
    appliedMore.requestId,
    appliedMore.upstreamRequestId,
    isAdmin && appliedMore.username,
    isAdmin && appliedMore.channel,
  ].filter(Boolean).length
  const setMoreField = <K extends keyof MoreFilters>(
    field: K,
    value: MoreFilters[K]
  ) => setMore((current) => ({ ...current, [field]: value }))
  const applyMore = (next: MoreFilters) => {
    apply({
      type: [next.type],
      group: next.group || undefined,
      requestId: next.requestId.trim() || undefined,
      upstreamRequestId: next.upstreamRequestId.trim() || undefined,
      ...(isAdmin
        ? {
            username: next.username.trim() || undefined,
            channel: next.channel.trim() || undefined,
          }
        : {}),
    })
    setMoreOpen(false)
  }
  const clearMore = () =>
    applyMore({
      type: LOG_TYPE_ALL_VALUE,
      group: '',
      requestId: '',
      upstreamRequestId: '',
      username: '',
      channel: '',
    })
  const handleMoreKeyDown = (e: React.KeyboardEvent) => {
    // The Enter that picks an IME candidate must not apply and close the panel.
    if (e.key === 'Enter' && !isImeKeyEvent(e)) applyMore(more)
  }

  const { data: adminGroups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => requireServerSuccess(await getGroups()),
    enabled: isAdmin,
  })
  const { data: userGroups } = useQuery({
    queryKey: ['user-groups'],
    queryFn: async () => requireServerSuccess(await getUserGroups()),
    enabled: !isAdmin,
  })
  const groupOptions = useMemo(() => {
    const groups = isAdmin
      ? (adminGroups?.data ?? [])
      : Object.keys(userGroups?.data ?? {})
    return groups
      .filter((group) => group !== 'auto')
      .map((group) => ({ label: group, value: group }))
  }, [isAdmin, adminGroups, userGroups])

  const logTypeItems = useMemo(
    () =>
      LOG_TYPE_FILTERS.map((type) => ({
        value: type.value,
        label: t(type.label),
        deprecated: type.deprecated,
      })),
    [t]
  )
  const selectedLogType = logTypeItems.find((type) => type.value === more.type)
  const deprecatedTypeDescription = t(
    'Only used to find historical logs. New records are available in Audit Logs.'
  )

  const masked = sensitiveVisible ? undefined : '[-webkit-text-security:disc]'

  return (
    <LogsToolbar>
      <LogsTimeRangePicker
        start={start}
        end={end}
        onChange={(range) =>
          apply({
            startTime: range.start.getTime(),
            endTime: range.end.getTime(),
          })
        }
      />

      <LogsKeyFilter
        value={searchParams.token ?? ''}
        onChange={(token) => apply({ token })}
        maskedClassName={masked}
      />

      <LogsSearchInput
        value={searchParams.model ?? ''}
        onApply={(model) => apply({ model: model || undefined })}
        placeholder={t('Search models...')}
        label={t('Model Name')}
        className='w-full max-sm:order-1 sm:w-52'
      />

      <Popover
        open={moreOpen}
        onOpenChange={(open) => {
          if (open) setMore(moreFiltersOf(searchParams))
          setMoreOpen(open)
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type='button'
              variant='outline'
              className={cn(
                'h-8 gap-1.5 px-2.5 font-normal',
                moreCount > 0 && 'text-primary'
              )}
            />
          }
        >
          <SlidersHorizontal className='text-muted-foreground size-4' />
          {t('More filters')}
          {moreCount > 0 && (
            <Badge className='size-5 justify-center p-0 text-[10px]'>
              {moreCount}
            </Badge>
          )}
        </PopoverTrigger>
        <PopoverContent
          align='start'
          className='w-[min(20rem,calc(100vw-2rem))] gap-3 p-3'
        >
          <div className='flex flex-col gap-1.5'>
            <span className='text-muted-foreground text-xs'>{t('Type')}</span>
            <Select
              items={logTypeItems}
              value={more.type}
              onValueChange={(value) =>
                setMoreField(
                  'type',
                  value !== null && isLogTypeValue(value)
                    ? value
                    : LOG_TYPE_ALL_VALUE
                )
              }
            >
              <SelectTrigger
                aria-label={t('Type')}
                aria-description={
                  selectedLogType?.deprecated
                    ? deprecatedTypeDescription
                    : undefined
                }
                className='w-full'
              >
                <SelectValue className='min-w-0'>
                  <span className='truncate'>
                    {selectedLogType?.label ?? t('All Types')}
                  </span>
                  {selectedLogType?.deprecated && (
                    <Badge
                      variant='secondary'
                      className='h-4 px-1.5 text-[10px] font-normal'
                      title={deprecatedTypeDescription}
                    >
                      {t('Deprecated')}
                    </Badge>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger={false}
                className='max-w-[calc(100vw-2rem)] min-w-52'
              >
                <SelectGroup>
                  {LOG_TYPE_FILTERS.map((type) => (
                    <SelectItem
                      key={type.value}
                      value={type.value}
                      className='[&_[data-slot=select-item-text]]:items-center'
                      aria-description={
                        type.deprecated ? deprecatedTypeDescription : undefined
                      }
                    >
                      {t(type.label)}
                      {type.deprecated && (
                        <Badge
                          variant='secondary'
                          className='h-4 px-1.5 text-[10px] font-normal'
                          title={deprecatedTypeDescription}
                        >
                          {t('Deprecated')}
                        </Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className={cn('flex flex-col gap-1.5', masked)}>
            <span className='text-muted-foreground text-xs'>{t('Group')}</span>
            <Combobox
              options={groupOptions}
              allowCustomValue
              aria-label={t('Group')}
              emptyText={t('No group found.')}
              placeholder={t('Group')}
              className='h-8 min-w-0 text-sm leading-5'
              popupClassName={masked}
              value={more.group}
              onValueChange={(value) => setMoreField('group', value ?? '')}
              onKeyDown={handleMoreKeyDown}
            />
          </div>

          {isAdmin && (
            <div className='grid grid-cols-2 gap-2'>
              <MoreField label={t('Username')}>
                <Input
                  autoComplete='off'
                  aria-label={t('Username')}
                  className={cn('h-8 text-sm', masked)}
                  value={more.username}
                  onChange={(e) => setMoreField('username', e.target.value)}
                  onKeyDown={handleMoreKeyDown}
                />
              </MoreField>
              <MoreField label={t('Channel ID')}>
                <Input
                  autoComplete='off'
                  aria-label={t('Channel ID')}
                  className='h-8 text-sm'
                  value={more.channel}
                  onChange={(e) => setMoreField('channel', e.target.value)}
                  onKeyDown={handleMoreKeyDown}
                />
              </MoreField>
            </div>
          )}

          <MoreField label={t('Request ID')}>
            <Input
              autoComplete='off'
              aria-label={t('Request ID')}
              className='h-8 text-sm'
              value={more.requestId}
              onChange={(e) => setMoreField('requestId', e.target.value)}
              onKeyDown={handleMoreKeyDown}
            />
          </MoreField>
          <MoreField label={t('Upstream Request ID')}>
            <Input
              autoComplete='off'
              aria-label={t('Upstream Request ID')}
              className='h-8 text-sm'
              value={more.upstreamRequestId}
              onChange={(e) =>
                setMoreField('upstreamRequestId', e.target.value)
              }
              onKeyDown={handleMoreKeyDown}
            />
          </MoreField>

          <div className='flex justify-end gap-2 pt-1'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='h-8'
              disabled={moreCount === 0}
              onClick={clearMore}
            >
              {t('Clear')}
            </Button>
            <Button
              type='button'
              size='sm'
              className='h-8'
              onClick={() => applyMore(more)}
            >
              {t('Apply')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <div className='flex min-w-0 items-center gap-1 max-sm:order-2 max-sm:w-full sm:ms-auto'>
        <CommonLogsStats total={props.total} />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setSensitiveVisible(!sensitiveVisible)}
                aria-label={sensitiveVisible ? t('Hide') : t('Show')}
                className='text-muted-foreground hover:text-foreground size-8'
              />
            }
          >
            {sensitiveVisible ? <Eye /> : <EyeOff />}
          </TooltipTrigger>
          <TooltipContent>
            {sensitiveVisible ? t('Hide') : t('Show')}
          </TooltipContent>
        </Tooltip>
        <LogsRefreshButton />
        <ExportLogsDialog />
        {/* Phones show cards, so there are no columns to pick. */}
        <div className='max-sm:hidden'>
          <DataTableViewOptions table={props.table} />
        </div>
      </div>
    </LogsToolbar>
  )
}

function MoreField(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex min-w-0 flex-col gap-1.5'>
      <span className='text-muted-foreground text-xs'>{props.label}</span>
      {props.children}
    </div>
  )
}
