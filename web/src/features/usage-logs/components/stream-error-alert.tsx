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
import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import type { LogOtherData } from '../types'

/**
 * The red alert of a stream that did not end cleanly. Hover or focus shows
 * why it ended and how many soft errors it had. It sits in clickable log
 * rows, so its own clicks and keys stop here.
 */
export function StreamErrorAlert(props: {
  streamStatus: NonNullable<LogOtherData['stream_status']>
  iconClassName?: string
}) {
  const { t } = useTranslation()
  const label = `${t('Stream Status')}: ${t('Error')}`
  const errorCount = props.streamStatus.error_count ?? 0
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type='button'
              aria-label={label}
              className='focus-visible:ring-ring/50 inline-flex rounded-full outline-none focus-visible:ring-2'
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          }
        >
          <CircleAlert
            aria-hidden='true'
            className={cn('text-destructive', props.iconClassName)}
          />
        </TooltipTrigger>
        <TooltipContent>
          <div className='space-y-0.5 text-xs'>
            <p>{label}</p>
            <p>{props.streamStatus.end_reason || 'unknown'}</p>
            {errorCount > 0 && (
              <p>
                {t('Soft Errors')}: {errorCount}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
