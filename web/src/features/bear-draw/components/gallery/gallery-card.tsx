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
import { Sparkles, Upload } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import type { GalleryItem } from '../../data/gallery'
import { cardBadge, COVER_SMALL_W, COVER_W, coverRatio } from './gallery-item'
import { promptSnippet } from './prompt-template'

type GalleryCardProps = {
  item: GalleryItem
  /** The card's width on screen (`sizes`), for picking the picture size. */
  sizes: string
  /** In the wall's top row: loads at once, before the rest. */
  top: boolean
  onTopLoaded?: () => void
  onOpen: (item: GalleryItem) => void
  onUse: (item: GalleryItem) => void
}

/** One picture on the 玩法 wall: click for the prompt, 「用这个」 to use it. */
export const GalleryCard = memo(function GalleryCard(props: GalleryCardProps) {
  const { t } = useTranslation()
  const it = props.item
  const badge = cardBadge(it)
  return (
    <figure className='bd-gc'>
      <div className='bd-gc-media' style={{ aspectRatio: coverRatio(it) }}>
        <button
          type='button'
          className='bd-gc-open'
          aria-label={t('See the prompt of “{{title}}”', { title: it.title })}
          onClick={() => props.onOpen(it)}
        >
          <img
            src={it.cover}
            srcSet={
              it.coverSmall === it.cover
                ? undefined
                : `${it.coverSmall} ${COVER_SMALL_W}w, ${it.cover} ${COVER_W}w`
            }
            sizes={props.sizes}
            alt=''
            loading={props.top ? 'eager' : 'lazy'}
            fetchPriority={props.top ? 'high' : 'auto'}
            decoding='async'
            onLoad={props.onTopLoaded}
            onError={props.onTopLoaded}
          />
        </button>
        {badge === 'photo' && (
          <span className='bd-gc-ba'>
            <Upload aria-hidden='true' />
            {t('Uses your photo')}
          </span>
        )}
        {badge === 'native' && (
          <span className='bd-gc-ba bd-gc-native'>
            {t('GPT Image 2.5 original')}
          </span>
        )}
        <div className='bd-gc-hover'>
          <p aria-hidden='true'>{promptSnippet(it.prompt)}</p>
          <button
            type='button'
            className='bd-gc-use'
            aria-label={t('Use “{{title}}”', { title: it.title })}
            onClick={() => props.onUse(it)}
          >
            <Sparkles aria-hidden='true' />
            {t('Use this')}
          </button>
        </div>
      </div>
      <figcaption>
        <b>{it.title}</b>
        <span>{it.category}</span>
      </figcaption>
    </figure>
  )
})
