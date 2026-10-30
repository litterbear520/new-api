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
import { CalendarDays, Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

import {
  formatRangeLabel,
  fromInputValue,
  matchPreset,
  presetRange,
  TIME_PRESET_LABELS,
  TIME_PRESETS,
  toInputValue,
  type TimePreset,
} from '../lib/time-range'

interface LogsTimeRangePickerProps {
  start?: Date
  end?: Date
  onChange: (range: { start: Date; end: Date }) => void
  className?: string
}

/**
 * The time button of the logs toolbar: a preset applies at once, a custom
 * range after 「应用」.
 */
export function LogsTimeRangePicker(props: LogsTimeRangePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draftStart, setDraftStart] = useState('')
  const [draftEnd, setDraftEnd] = useState('')

  // Which preset was clicked last, for days when two give the same range.
  const [picked, setPicked] = useState<TimePreset | null>(null)
  const preset = matchPreset(props.start, props.end, undefined, picked)
  const label = preset
    ? t(TIME_PRESET_LABELS[preset])
    : formatRangeLabel(props.start, props.end) || t('Time range')
  const customStart = fromInputValue(draftStart)
  const customEnd = fromInputValue(draftEnd)
  const customValid =
    customStart != null &&
    customEnd != null &&
    customStart.getTime() < customEnd.getTime()

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraftStart(toInputValue(props.start))
      setDraftEnd(toInputValue(props.end))
    }
    setOpen(next)
  }

  const choose = (range: { start: Date; end: Date }) => {
    props.onChange(range)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            aria-label={`${t('Time range')}: ${label}`}
            className={cn(
              'h-8 gap-1.5 px-2.5 font-normal tabular-nums',
              props.className
            )}
          />
        }
      >
        <CalendarDays className='text-muted-foreground size-4' />
        <span className='truncate'>{label}</span>
        <ChevronDown className='text-muted-foreground size-3.5' />
      </PopoverTrigger>
      <PopoverContent align='start' className='w-72 gap-0 p-1.5'>
        <div className='flex flex-col'>
          {TIME_PRESETS.map((key) => (
            <Button
              key={key}
              type='button'
              variant='ghost'
              aria-pressed={preset === key}
              onClick={() => {
                setPicked(key)
                choose(presetRange(key))
              }}
              className='hover:bg-accent focus-visible:bg-accent justify-between rounded-md border-0 px-2 font-normal focus-visible:ring-0'
            >
              {t(TIME_PRESET_LABELS[key])}
              {preset === key && <Check className='size-4' />}
            </Button>
          ))}
        </div>
        <Separator className='my-1.5' />
        <div className='flex flex-col gap-2 px-2 pt-1 pb-1.5'>
          <p className='text-muted-foreground text-xs'>{t('Custom range')}</p>
          <Input
            type='datetime-local'
            step={1}
            aria-label={t('Start Time')}
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
            className='h-8 text-sm tabular-nums'
          />
          <Input
            type='datetime-local'
            step={1}
            aria-label={t('End Time')}
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
            className='h-8 text-sm tabular-nums'
          />
          <Button
            type='button'
            size='sm'
            className='h-8'
            disabled={!customValid}
            onClick={() => {
              if (customStart && customEnd) {
                setPicked(null)
                choose({ start: customStart, end: customEnd })
              }
            }}
          >
            {t('Apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
