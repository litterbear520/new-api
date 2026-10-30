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
import { getRouteApi } from '@tanstack/react-router'
import type { Table } from '@tanstack/react-table'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableViewOptions } from '@/components/data-table'

import { getDefaultTimeRange } from '../lib/utils'
import type { LogCategory } from '../types'
import { LogsTimeRangePicker } from './logs-time-range-picker'
import {
  LogsRefreshButton,
  LogsSearchInput,
  LogsToolbar,
} from './logs-toolbar-parts'
import { useLogsViewScope } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

type LogsSearch = ReturnType<typeof route.useSearch>
type TaskLikeLogCategory = Extract<LogCategory, 'drawing' | 'task'>

interface TaskLogsFilterBarProps<TData> {
  table: Table<TData>
  logCategory: TaskLikeLogCategory
}

/** One-row toolbar of the task and drawing logs; every field applies at once. */
export function TaskLogsFilterBar<TData>(props: TaskLogsFilterBarProps<TData>) {
  const { t } = useTranslation()
  const navigate = route.useNavigate()
  const searchParams = route.useSearch()
  const { isAdminView: isAdmin } = useLogsViewScope()

  const apply = useCallback(
    (patch: Partial<LogsSearch>) => {
      void navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) })
    },
    [navigate]
  )

  const defaultRange = useMemo(() => getDefaultTimeRange(), [])
  const start = searchParams.startTime
    ? new Date(searchParams.startTime)
    : defaultRange.start
  const end = searchParams.endTime
    ? new Date(searchParams.endTime)
    : defaultRange.end

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
      <LogsSearchInput
        value={searchParams.filter ?? ''}
        onApply={(filter) => apply({ filter: filter || undefined })}
        placeholder={
          props.logCategory === 'drawing'
            ? t('Filter by MjProxy task ID')
            : t('Filter by task ID')
        }
        label={t('Task ID')}
        className='w-full sm:w-60'
      />
      {isAdmin && (
        <LogsSearchInput
          value={searchParams.channel ?? ''}
          onApply={(channel) => apply({ channel: channel || undefined })}
          placeholder={t('Channel ID')}
          label={t('Channel ID')}
          className='w-full sm:w-36'
        />
      )}
      <div className='ms-auto flex items-center gap-1'>
        <LogsRefreshButton />
        <div className='max-sm:hidden'>
          <DataTableViewOptions table={props.table} />
        </div>
      </div>
    </LogsToolbar>
  )
}
