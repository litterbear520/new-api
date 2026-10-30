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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/stores/auth-store'

import { DRAW_GUIDE_URL } from '../../constants'
import type { Skill } from '../../types'
import { HelpRow } from './help-row'
import { dayPart } from './home-text'
import { ResumeStrip } from './resume-strip'

function useGreeting(): string {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const name = user?.display_name || user?.username || ''
  let greeting: string
  switch (dayPart(new Date().getHours())) {
    case 'late':
      greeting = t('It’s late')
      break
    case 'morning':
      greeting = t('Good morning')
      break
    case 'noon':
      greeting = t('Good noon')
      break
    case 'afternoon':
      greeting = t('Good afternoon')
      break
    default:
      greeting = t('Good evening')
  }
  return name ? t('{{greeting}}, {{name}}', { greeting, name }) : greeting
}

type HeroProps = {
  /** The composer, in its slot under the greeting. */
  composer: ReactNode
  onPick: (skill: Skill, text: string) => void
}

/**
 * Greeting, the composer, and under it two rows in Lovart's order: what the
 * bear can make, and the recent projects (labels in one column, buttons
 * starting on one line).
 */
export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const greeting = useGreeting()
  return (
    <section className='bd-hero'>
      <h1 className='bd-greet'>{greeting}</h1>
      <p className='bd-sub'>
        {t('Say your idea; the bear plans and draws a whole set for you.')}
        <a className='bd-link' href={DRAW_GUIDE_URL}>
          {t('Usage guide')}
        </a>
      </p>
      {props.composer}
      <div className='bd-rows'>
        <HelpRow onPick={props.onPick} />
        <ResumeStrip />
      </div>
    </section>
  )
}
