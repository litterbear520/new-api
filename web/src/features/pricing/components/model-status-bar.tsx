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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getSuccessRateDotClass } from '@/features/performance-metrics/lib/format'
import type { SuccessRatePoint } from '@/features/performance-metrics/types'
import { toIntlLocale } from '@/i18n/languages'
import { cn } from '@/lib/utils'

import { hourSlots, latestSampleTs } from '../lib/hour-slots'

function slotColor(rate: number | null): string {
  return rate === null ? 'bg-muted-foreground/15' : getSuccessRateDotClass(rate)
}

/**
 * OpenModel-style 24-hour strip: green when requests went through. A tap,
 * hover or Enter opens every hour's rate, since a title tooltip never shows
 * on touch screens. It sits above the card's full-size link.
 */
export function ModelStatusBar(props: {
  series?: SuccessRatePoint[]
  windowEnd?: number
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const slots = useMemo(
    () =>
      hourSlots(
        props.series,
        props.windowEnd ??
          latestSampleTs(props.series) ??
          Math.floor(Date.now() / 1000)
      ),
    [props.series, props.windowEnd]
  )
  const hourFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(
        toIntlLocale(i18n.resolvedLanguage || i18n.language),
        {
          hour: '2-digit',
          minute: '2-digit',
        }
      ),
    [i18n.resolvedLanguage, i18n.language]
  )
  const label = slots.some((slot) => slot.rate !== null)
    ? t('Status, last 24 hours')
    : t('No requests in the last 24 hours')

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        className={cn(
          'focus-visible:ring-ring relative z-10 -my-2 block w-full rounded-sm py-2 outline-none focus-visible:ring-2',
          props.className
        )}
      >
        <div
          role='img'
          aria-label={label}
          className='flex h-2 w-full gap-[3px]'
        >
          {slots.map((slot) => (
            <span
              key={slot.ts}
              className={cn(
                'h-full min-w-0 flex-1 rounded-[2px]',
                slotColor(slot.rate)
              )}
            />
          ))}
        </div>
      </PopoverTrigger>
      <PopoverContent side='top' className='w-auto gap-2 p-3'>
        <PopoverTitle className='text-xs'>{label}</PopoverTitle>
        <ol className='grid grid-flow-col grid-rows-8 gap-x-5 gap-y-1 font-mono text-xs tabular-nums'>
          {slots.map((slot) => (
            <li key={slot.ts} className='flex items-center gap-1.5'>
              <span
                aria-hidden='true'
                className={cn('size-1.5 rounded-full', slotColor(slot.rate))}
              />
              <span className='text-muted-foreground'>
                {hourFormat.format(slot.ts * 1000)}
              </span>
              {slot.rate === null ? (
                <span className='text-muted-foreground/60'>
                  <span aria-hidden='true'>—</span>
                  <span className='sr-only'>{t('No requests')}</span>
                </span>
              ) : (
                <span>{slot.rate}%</span>
              )}
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  )
}
