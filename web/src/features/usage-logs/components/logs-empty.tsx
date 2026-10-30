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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { LOG_TYPE_ALL_VALUE } from '../constants'
import { presetRange } from '../lib/time-range'
import { getDefaultTimeRange } from '../lib/utils'
import type { LogCategory } from '../types'

const route = getRouteApi('/_authenticated/usage-logs/$section')

const DAY_MS = 24 * 3600 * 1000
// Widths (%) of the grey placeholder rows, fading out downwards.
const SKELETON_COLUMNS = ['time', 'model', 'tokens', 'cost'] as const
const SKELETON_ROWS: Record<(typeof SKELETON_COLUMNS)[number], number>[] = [
  { time: 30, model: 26, tokens: 18, cost: 14 },
  { time: 34, model: 22, tokens: 16, cost: 16 },
  { time: 28, model: 24, tokens: 20, cost: 12 },
]

// Every URL filter of the logs besides the time range and the log type.
const FILTER_FIELDS = [
  'model',
  'token',
  'group',
  'requestId',
  'upstreamRequestId',
  'username',
  'channel',
  'filter',
] as const
const NO_FILTERS = Object.fromEntries(
  FILTER_FIELDS.map((field) => [field, undefined])
)

const HINTS: Record<LogCategory, string> = {
  common: 'Every request your keys send shows up here.',
  task: 'Video, music and other async tasks show up here.',
  drawing: 'Midjourney drawing tasks show up here.',
}

/**
 * An empty logs table: a grey sketch of rows, one line of text and the one
 * step that most often finds the logs (a longer range, or no filters).
 */
export function LogsEmpty(props: { section: LogCategory }) {
  const { t } = useTranslation()
  const navigate = route.useNavigate()
  const search = route.useSearch()

  const fallback = getDefaultTimeRange()
  const start = search.startTime ?? fallback.start.getTime()
  const end = search.endTime ?? fallback.end.getTime()
  const shortRange = end - start < 29 * DAY_MS
  const typeFiltered =
    Array.isArray(search.type) &&
    search.type.some((type) => type !== LOG_TYPE_ALL_VALUE)
  const filtered =
    typeFiltered || FILTER_FIELDS.some((field) => Boolean(search[field]))

  const go = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) })

  return (
    <div className='flex min-h-[340px] flex-col items-center justify-center gap-1.5 px-4 py-10 text-center'>
      <div aria-hidden className='mb-4 flex w-40 flex-col gap-2.5'>
        <span className='bg-muted-foreground/20 h-2.5 rounded-full' />
        {SKELETON_ROWS.map((row, index) => (
          <div
            key={Object.values(row).join('-')}
            className='flex justify-between'
            style={{ opacity: 0.8 - index * 0.25 }}
          >
            {SKELETON_COLUMNS.map((column) => (
              <span
                key={column}
                className='bg-muted-foreground/15 h-2 rounded-full'
                style={{ width: `${row[column]}%` }}
              />
            ))}
          </div>
        ))}
      </div>
      <p className='text-sm font-medium'>{t('No logs in this range')}</p>
      <p className='text-muted-foreground text-sm'>
        {filtered
          ? t('Try fewer filters or a longer time range.')
          : t(HINTS[props.section])}
      </p>
      <div className='mt-3 flex flex-wrap justify-center gap-2'>
        {filtered && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-8'
            onClick={() =>
              go({
                ...NO_FILTERS,
                type:
                  props.section === 'common' ? [LOG_TYPE_ALL_VALUE] : undefined,
              })
            }
          >
            {t('Clear filters')}
          </Button>
        )}
        {shortRange && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-8'
            onClick={() => {
              const range = presetRange('30d')
              go({
                startTime: range.start.getTime(),
                endTime: range.end.getTime(),
              })
            }}
          >
            {t('Show last 30 days')}
          </Button>
        )}
      </div>
    </div>
  )
}
