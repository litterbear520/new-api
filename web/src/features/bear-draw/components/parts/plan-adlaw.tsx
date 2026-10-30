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
import { ArrowRight, CircleCheck, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { fixAdLaw } from '../../lib/engine'
import type { AdLawHit, PlanItem } from '../../types'

/** Flagged words grouped by the picture they would be printed on. */
function byPicture(hits: AdLawHit[], items: PlanItem[]) {
  return items
    .filter((it) => it.on)
    .map((it) => ({ item: it, hits: hits.filter((h) => h.itemId === it.id) }))
    .filter((g) => g.hits.length > 0)
}

/**
 * 广告法 check on a waiting plan: the words that may break the advertising
 * law, per picture, struck through with what replaces them, and
 * 「全部替换」 before anything is drawn.
 */
export function PlanAdLaw(props: {
  projectId: string
  partId: string
  hits: AdLawHit[]
  items: PlanItem[]
  fixed: boolean
  /** The plan still waits for 开始画, so the words can be replaced. */
  pending: boolean
}) {
  const { t } = useTranslation()
  if (props.fixed) {
    return (
      <div className='bd-law is-fixed'>
        <div className='bd-law-hd'>
          <CircleCheck aria-hidden='true' />
          {t('Replaced the words the advertising law may not allow')}
        </div>
      </div>
    )
  }
  if (!props.pending || !props.hits.length) return null
  const groups = byPicture(props.hits, props.items)
  if (!groups.length) return null
  return (
    <div className='bd-law' role='alert'>
      <div className='bd-law-hd'>
        <TriangleAlert aria-hidden='true' />
        {t('Words on these pictures may break the advertising law')}
      </div>
      <ul>
        {groups.map((g) => (
          <li key={g.item.id}>
            <span className='bd-law-lb'>{g.item.label}</span>
            {g.hits.map((h) => (
              <span key={h.word} className='bd-law-w' title={h.reason}>
                <s>{h.word}</s>
                <ArrowRight aria-hidden='true' />
                <b>{h.fix || t('Remove')}</b>
              </span>
            ))}
          </li>
        ))}
      </ul>
      <div className='bd-law-ft'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='bd-cb bd-cb-line'
          onClick={() => fixAdLaw(props.projectId, props.partId)}
        >
          {t('Replace them all')}
        </Button>
      </div>
    </div>
  )
}
