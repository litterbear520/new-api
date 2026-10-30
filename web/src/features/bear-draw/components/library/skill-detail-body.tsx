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
import { CornerDownRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

import type { Skill } from '../../types'
import { keyed } from '../home/home-text'
import { CoverArt } from './cover-art'

/** Sample pictures of the skill, swipeable; generated art when there are none. */
export function SkillCovers(props: { skill: Skill }) {
  const covers = props.skill.covers
  if (!covers.length) {
    return (
      <div className='bd-sd-art'>
        <CoverArt skill={props.skill} />
      </div>
    )
  }
  return (
    <Carousel opts={{ align: 'start' }} className='bd-sd-gal'>
      <CarouselContent>
        {covers.map((src) => (
          <CarouselItem key={src} className='bd-sd-slide'>
            <figure>
              <img src={src} alt='' loading='lazy' decoding='async' />
            </figure>
          </CarouselItem>
        ))}
      </CarouselContent>
      {covers.length > 1 && (
        <>
          <CarouselPrevious className='bd-sd-nav bd-sd-prev' />
          <CarouselNext className='bd-sd-nav bd-sd-next' />
        </>
      )}
    </Carousel>
  )
}

type ColumnsProps = {
  skill: Skill
  /** A starter line was picked (without the 用「技能」 prefix). */
  onStarter: (text: string) => void
}

/** What the skill delivers, what it asks first, and lines to start with. */
export function SkillColumns(props: ColumnsProps) {
  const { t } = useTranslation()
  const s = props.skill
  const deliverables = keyed(s.deliverables.map((d) => d.label)).map(
    (k, i) => ({ key: k.key, d: s.deliverables[i] })
  )
  const questions = keyed(s.questions.map((q) => q.q)).map((k, i) => ({
    key: k.key,
    q: s.questions[i],
  }))
  const starters = keyed(s.starters)

  return (
    <div className='bd-sd-cols'>
      <div>
        <h3>{t('What it delivers')}</h3>
        {deliverables.length ? (
          <ol className='bd-sd-del'>
            {deliverables.map((x, i) => (
              <li key={x.key}>
                <span className='bd-sd-n' aria-hidden='true'>
                  {i + 1}
                </span>
                <b>{x.d.label}</b>
                <span>{[x.d.size, x.d.ratio].filter(Boolean).join(' · ')}</span>
                {x.d.note ? <em>{x.d.note}</em> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className='bd-muted'>{t('Decided in the chat, case by case.')}</p>
        )}
      </div>
      <div>
        {questions.length > 0 && (
          <>
            <h3>{t('What it asks you first')}</h3>
            <ul className='bd-sd-q'>
              {questions.map((x) => (
                <li key={x.key}>
                  {x.q.q}
                  <span>{x.q.options.join(' / ')}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {starters.length > 0 && (
          <>
            <h3>{t('You can say')}</h3>
            <div className='bd-sd-st'>
              {starters.map((x) => (
                <button
                  key={x.key}
                  type='button'
                  onClick={() => props.onStarter(x.text)}
                >
                  <CornerDownRight aria-hidden='true' />
                  {x.text}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
