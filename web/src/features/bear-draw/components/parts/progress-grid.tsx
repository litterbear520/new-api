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
import { useTranslation } from 'react-i18next'

import { useNow } from '@/features/draw/hooks/use-now'
import { cn } from '@/lib/utils'

import type { Part, ProgressItem } from '../../types'
import { clock, runStart } from './format'
import { usePartActions } from './part-actions'
import { ProgressTile } from './progress-tile'

type ProgressPart = Extract<Part, { type: 'progress' }>

/** 「正在画 2/5  0:31」 while the set draws, 「5 张」 after. */
function SetHeader(props: { items: ProgressItem[]; active: boolean }) {
  const { t } = useTranslation()
  const now = useNow(props.active, 1000)
  const done = props.items.filter((x) => x.status === 'done').length
  const first = runStart(props.items)
  return (
    <div className='bd-set-hd'>
      <span className={cn('bd-set-w', props.active && 'is-live')}>
        {props.active
          ? t('Drawing {{done}}/{{total}}', {
              done,
              total: props.items.length,
            })
          : t('Pictures: {{count}}', { count: props.items.length })}
      </span>
      {props.active && first != null && (
        <span className='bd-set-t bd-num'>{clock((now - first) / 1000)}</span>
      )}
    </div>
  )
}

/**
 * A set of pictures, inline in the chat: tiles that show the dot screen
 * while waiting, reveal each picture as it arrives, and open the canvas at
 * that picture on click. One or two pictures get bigger tiles.
 */
export function ProgressGrid(props: { projectId: string; part: ProgressPart }) {
  const actions = usePartActions()
  const items = props.part.items
  const active = items.some(
    (x) => x.status === 'queued' || x.status === 'drawing'
  )
  return (
    <div className={cn('bd-set', items.length <= 2 && 'is-few')}>
      {(!props.part.compact || active) && (
        <SetHeader items={items} active={active} />
      )}
      <div className='bd-set-grid'>
        {items.map((it, i) => (
          <ProgressTile
            key={it.id}
            projectId={props.projectId}
            item={it}
            index={i}
            onOpen={(nodeId) => actions.openCanvas([nodeId])}
          />
        ))}
      </div>
    </div>
  )
}
