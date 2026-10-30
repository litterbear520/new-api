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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { UsageLog } from '../data/schema'
import { parseLogOther, renderLogContent } from '../lib/format'
import { DetailsDialog } from './dialogs/details-dialog'

export type LogDetailSegment = {
  text: string
  muted?: boolean
  danger?: boolean
}

/**
 * The first detail segment of a log (or its content) as a link that opens
 * the full details: the admin 详情 column and the bottom line of every
 * mobile card. Segments come from useLogDetailSegments.
 */
export function LogDetailsCell(props: {
  log: UsageLog
  segments: LogDetailSegment[]
  isAdmin: boolean
  isRoot: boolean
}) {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const log = props.log
  const primary = props.segments[0]
  const hasMore = props.segments.length > 1
  let primaryTextClass = 'text-foreground'
  if (primary?.muted) {
    primaryTextClass = 'text-muted-foreground/60'
  } else if (primary?.danger) {
    primaryTextClass = 'text-red-600 dark:text-red-400'
  }
  let detailPreview = <span className='text-muted-foreground/40'>—</span>
  if (primary) {
    detailPreview = (
      <span
        className={cn(
          'truncate leading-snug group-hover:underline',
          primaryTextClass
        )}
      >
        {primary.text}
        {hasMore && (
          <span className='text-muted-foreground/40 ml-0.5'>
            +{props.segments.length - 1}
          </span>
        )}
      </span>
    )
  } else if (log.content) {
    detailPreview = (
      <span className='text-muted-foreground truncate group-hover:underline'>
        {renderLogContent(parseLogOther(log.other), t) ?? log.content}
      </span>
    )
  }

  return (
    <>
      <button
        type='button'
        className='group flex max-w-[200px] items-center gap-1 text-left text-xs'
        onClick={(e) => {
          // The row opens the same dialog; one is enough.
          e.stopPropagation()
          setDialogOpen(true)
        }}
        title={t('Click to view full details')}
      >
        {detailPreview}
      </button>
      <DetailsDialog
        log={log}
        isAdmin={props.isAdmin}
        isRoot={props.isRoot}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
