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
import { BookOpen, ChevronLeft, CornerDownRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SKILL_CATEGORIES, SKILLS } from '../../data/skills'
import type { Skill } from '../../types'
import { categoryIcon } from '../library/skill-display'
import { categoryStarters } from './home-text'

type HelpRowProps = {
  /** A starter line was picked: put its skill and text in the composer. */
  onPick: (skill: Skill, text: string) => void
}

/** 「小熊帮你做：」 category pills; a pill opens three starter lines. */
export function HelpRow(props: HelpRowProps) {
  const { t } = useTranslation()
  const [cat, setCat] = useState<string | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  // where focus goes after the row changes (the row's buttons are replaced)
  const focusNext = useRef<string | null>(null)

  useEffect(() => {
    const target = focusNext.current
    focusNext.current = null
    if (!target) return
    rowRef.current
      ?.querySelector<HTMLElement>(`[data-focus="${target}"]`)
      ?.focus()
  }, [cat])

  const open = (id: string) => {
    focusNext.current = 'first'
    setCat(id)
  }
  const back = () => {
    focusNext.current = cat
    setCat(null)
  }

  const label = (
    <span className='bd-row-l'>{t('The bear can help you make:')}</span>
  )

  if (!cat) {
    return (
      <div ref={rowRef} className='bd-row'>
        {label}
        <div className='bd-row-items'>
          {SKILL_CATEGORIES.map((c) => {
            const Icon = categoryIcon(c.id)
            return (
              <button
                key={c.id}
                type='button'
                className='bd-pill'
                data-focus={c.id}
                onClick={() => open(c.id)}
              >
                <Icon aria-hidden='true' />
                {c.name}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const lines = categoryStarters(SKILLS, cat)
  return (
    <div ref={rowRef} className='bd-row'>
      {label}
      <div className='bd-starters'>
        {lines.map((line, i) => (
          <button
            key={line.skill.id}
            type='button'
            className='bd-starter'
            data-focus={i === 0 ? 'first' : undefined}
            onClick={() => props.onPick(line.skill, line.text)}
          >
            <CornerDownRight className='bd-starter-ar' aria-hidden='true' />
            <span>{t('Use')}</span>
            <span className='bd-starter-chip'>
              <BookOpen aria-hidden='true' />
              {line.skill.name}
            </span>
            <span>{line.text}</span>
          </button>
        ))}
        <button
          type='button'
          className='bd-starter bd-starter-back'
          data-focus={lines.length ? undefined : 'first'}
          onClick={back}
        >
          <ChevronLeft aria-hidden='true' />
          {t('Back')}
        </button>
      </div>
    </div>
  )
}
