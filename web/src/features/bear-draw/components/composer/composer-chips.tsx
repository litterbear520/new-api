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
import { BookOpen, Pencil, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Tip } from '@/features/draw/components/tip'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import type { BrandKit, Mode, Skill } from '../../types'
import { openDialog } from '../dialogs/dialog-bus'

/** A 玩法 from the home gallery, applied to this message. */
export type Preset = {
  id: string
  title: string
  needsPhoto: boolean
  /** What photo it wants, from the gallery item. */
  hint: string
}

type ChipsProps = {
  mode: Mode
  skill: Skill | null
  preset: Preset | null
  onClearSkill: () => void
  onClearPreset: () => void
}

/** The skill, 玩法 and brand kit this message uses, above the text. */
export function ComposerChips(props: ChipsProps) {
  const { t } = useTranslation()
  const brandKit = useBearDrawStore((s) => s.brandKit)
  const agent = props.mode === 'agent'
  const skill = agent ? props.skill : null
  const brand = agent ? brandKit : null
  if (!skill && !props.preset && !brand) return null
  return (
    <div className='bd-comp-chips'>
      {skill && (
        <span className='bd-cchip bd-cchip-skill'>
          <BookOpen aria-hidden='true' />
          <span className='bd-cchip-name'>{skill.name}</span>
          <button
            type='button'
            className='bd-cchip-x'
            aria-label={t('Remove this skill')}
            onClick={props.onClearSkill}
          >
            <X aria-hidden='true' />
          </button>
        </span>
      )}
      {props.preset && (
        <span className='bd-cchip bd-cchip-preset'>
          <Sparkles aria-hidden='true' />
          <span className='bd-cchip-name'>
            {t('Preset: {{title}}', { title: props.preset.title })}
          </span>
          <button
            type='button'
            className='bd-cchip-x'
            aria-label={t('Remove this preset')}
            onClick={props.onClearPreset}
          >
            <X aria-hidden='true' />
          </button>
        </span>
      )}
      {brand && <BrandChip kit={brand} />}
    </div>
  )
}

/** On: every picture follows the kit. A click leaves it out of this work. */
function BrandChip(props: { kit: BrandKit }) {
  const { t } = useTranslation()
  const on = useBearDrawStore((s) => s.prefs.brand)
  const setPrefs = useBearDrawStore((s) => s.setPrefs)
  const colors = [...new Set(props.kit.colors)].slice(0, 3)
  return (
    <span className='bd-cchip bd-cchip-brand' data-off={on ? undefined : ''}>
      <Tip
        label={
          on
            ? t(
                'Every picture uses the brand colours, fonts and logo; click to leave it out'
              )
            : t('The brand kit is left out; click to use it again')
        }
      >
        <button
          type='button'
          className='bd-cchip-main'
          aria-pressed={on}
          onClick={() => setPrefs({ brand: !on })}
        >
          <span className='bd-swatches' aria-hidden='true'>
            {colors.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </span>
          <span className='bd-cchip-name'>
            {t('Brand: {{name}}', { name: props.kit.name })}
          </span>
        </button>
      </Tip>
      <button
        type='button'
        className='bd-cchip-x'
        aria-label={t('Edit the brand kit')}
        onClick={() => openDialog('brand')}
      >
        <Pencil aria-hidden='true' />
      </button>
    </span>
  )
}
