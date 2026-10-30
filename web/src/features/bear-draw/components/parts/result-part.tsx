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
import { Archive, CornerDownRight, Palette } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useMoney } from '@/features/draw/hooks/use-money'

import type { Part } from '../../types'
import { duration } from './format'
import { usePartActions } from './part-actions'

type ResultPartData = Extract<Part, { type: 'result' }>

/**
 * The end of a set: 「画好了 4 张，1 张没画成（没扣钱）」 with the total and
 * the time, 在画布里打开 / 打包下载, and up to three ↳ ideas for what next.
 */
export function ResultPart(props: { part: ResultPartData }) {
  const { t } = useTranslation()
  const money = useMoney()
  const actions = usePartActions()
  const r = props.part
  const bits: string[] = []
  if (r.done) bits.push(t('{{count}} done', { count: r.done }))
  if (r.failed) {
    bits.push(t('{{count}} not drawn (not charged)', { count: r.failed }))
  }
  if (r.stopped) {
    bits.push(t('{{count}} stopped (not charged)', { count: r.stopped }))
  }
  const groupId = r.groupId
  return (
    <div className='bd-res'>
      <div className='bd-res-l'>
        <b>{bits.join(t(', '))}</b>
        <span className='bd-muted bd-num'>
          {t('{{cost}} in total · took {{time}}', {
            cost: money.cost(r.cost),
            time: duration(r.secs, t),
          })}
        </span>
      </div>
      {groupId && (
        <div className='bd-res-a'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='bd-cb bd-cb-line'
            onClick={() => actions.openCanvas([groupId])}
          >
            <Palette aria-hidden='true' />
            {t('Open on the canvas')}
          </Button>
          {r.done > 0 && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='bd-cb bd-cb-ghost'
              onClick={() => actions.exportGroup(groupId)}
            >
              <Archive aria-hidden='true' />
              {t('Download as a zip')}
            </Button>
          )}
        </div>
      )}
      {r.suggestions.length > 0 && (
        <div className='bd-sugs'>
          {r.suggestions.slice(0, 3).map((s) => (
            <button
              key={s}
              type='button'
              className='bd-sug'
              onClick={() => actions.setComposerText(s)}
            >
              <CornerDownRight aria-hidden='true' />
              <span>{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
