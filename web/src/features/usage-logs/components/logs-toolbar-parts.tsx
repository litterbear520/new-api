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
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { RotateCw, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { isImeKeyEvent } from '../lib/ime'

const SEARCH_DELAY = 400
const LOGS_QUERY_KEYS: ReadonlyArray<readonly string[]> = [
  ['logs'],
  ['usage-logs-stats'],
]

interface LogsSearchInputProps {
  /** The applied value, from the URL. */
  value: string
  onApply: (value: string) => void
  placeholder: string
  label: string
  className?: string
  inputClassName?: string
}

/**
 * A search box of the logs toolbar: typing applies after a short pause,
 * Enter at once. While an IME composes (pinyin and the like) nothing applies
 * until the characters are chosen.
 */
export function LogsSearchInput(props: LogsSearchInputProps) {
  const [draft, setDraft] = useState(props.value)
  const [source, setSource] = useState(props.value)
  if (props.value !== source) {
    setSource(props.value)
    setDraft(props.value)
  }
  const timer = useRef<number | undefined>(undefined)
  const composing = useRef(false)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const commit = (value: string) => {
    window.clearTimeout(timer.current)
    const next = value.trim()
    if (next !== props.value) props.onApply(next)
  }
  const commitLater = (value: string) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => commit(value), SEARCH_DELAY)
  }

  return (
    <div className={cn('relative min-w-0', props.className)}>
      <Search className='text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2' />
      <Input
        type='search'
        autoComplete='off'
        aria-label={props.label}
        placeholder={props.placeholder}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          if (!composing.current) commitLater(e.target.value)
        }}
        onCompositionStart={() => {
          composing.current = true
          window.clearTimeout(timer.current)
        }}
        onCompositionEnd={(e) => {
          composing.current = false
          commitLater(e.currentTarget.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isImeKeyEvent(e)) commit(draft)
        }}
        className={cn('h-8 ps-8 text-sm', props.inputClassName)}
      />
    </div>
  )
}

/**
 * Fetches the page's data again (the logs by default); spins while the first
 * query key is loading.
 */
export function LogsRefreshButton(props: {
  queryKeys?: ReadonlyArray<readonly string[]>
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const queryKeys = props.queryKeys ?? LOGS_QUERY_KEYS
  const fetching = useIsFetching({ queryKey: queryKeys[0] })

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant='ghost'
            size='icon'
            aria-label={t('Refresh')}
            className='text-muted-foreground hover:text-foreground size-8'
            onClick={() => {
              for (const queryKey of queryKeys) {
                void queryClient.invalidateQueries({ queryKey })
              }
            }}
          />
        }
      >
        <RotateCw className={cn(fetching > 0 && 'animate-spin')} />
      </TooltipTrigger>
      <TooltipContent>{t('Refresh')}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The bar above a logs table. On phones it is a card of its own; from sm up
 * it is the top of one card with the table below it: the parent draws the
 * outer border and rounds the corners (see usage-logs-table), so the toolbar
 * keeps only the line underneath.
 */
export function LogsToolbar(props: { children: React.ReactNode }) {
  return (
    <div className='bg-card flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 sm:rounded-none sm:border-x-0 sm:border-t-0'>
      {props.children}
    </div>
  )
}
