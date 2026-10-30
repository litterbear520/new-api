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
import { Image as ImageIcon, Plus, Star, Trash2, User } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemConfigStore } from '@/stores/system-config-store'

import type { Skill } from '../../types'
import { CoverArt } from './cover-art'
import { repoName } from './skill-display'

type SkillCardProps = {
  skill: Skill
  favorite: boolean
  onOpen: (skill: Skill) => void
  onAdd: (skill: Skill) => void
  /** Only the user's own skills can be deleted. */
  onDelete?: (skill: Skill) => void
}

/** A skill in the feed or the library; the whole card opens it. */
export const SkillCard = memo(function SkillCard(props: SkillCardProps) {
  const { t } = useTranslation()
  const logo = useSystemConfigStore((s) => s.config.logo)
  const s = props.skill
  const cover = s.covers[0]
  const source = s.sources[0]

  return (
    <article className='bd-sc'>
      <h3 className='bd-sc-t'>
        <button
          type='button'
          className='bd-sc-open'
          onClick={() => props.onOpen(s)}
        >
          {s.name}
        </button>
      </h3>
      <div className='bd-sc-cover'>
        {cover ? (
          <img src={cover} alt='' loading='lazy' decoding='async' />
        ) : (
          <CoverArt skill={s} />
        )}
        <span className='bd-sc-badge' aria-hidden='true'>
          <ImageIcon />
        </span>
        {props.favorite && (
          <span className='bd-sc-fav' title={t('In your favourites')}>
            <Star aria-hidden='true' />
            <span className='bd-sr'>{t('In your favourites')}</span>
          </span>
        )}
        <button
          type='button'
          className='bd-sc-add'
          aria-label={t('Add “{{name}}” to the chat', { name: s.name })}
          onClick={() => props.onAdd(s)}
        >
          <Plus aria-hidden='true' />
          {t('Add to the chat')}
        </button>
        {props.onDelete && (
          <button
            type='button'
            className='bd-sc-del'
            aria-label={t('Delete “{{name}}”', { name: s.name })}
            onClick={() => props.onDelete?.(s)}
          >
            <Trash2 aria-hidden='true' />
          </button>
        )}
      </div>
      <p className='bd-sc-d'>{s.tagline || s.description}</p>
      <div className='bd-sc-m'>
        {s.mine ? (
          <span className='bd-sc-av bd-sc-av-me' aria-hidden='true'>
            <User />
          </span>
        ) : (
          <img className='bd-sc-av' src={logo} alt='' />
        )}
        <span>{s.author || t('My skill')}</span>
        {source && (
          <span className='bd-sc-src'>
            {'· '}
            {t('adapted from {{repo}}', { repo: repoName(source.repo) })}
          </span>
        )}
      </div>
    </article>
  )
})
