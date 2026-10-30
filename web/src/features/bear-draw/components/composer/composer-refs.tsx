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
import { ImagePlus, Upload, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Tip } from '@/features/draw/components/tip'
import { useImageUrl } from '@/features/draw/hooks/use-image-url'

import { MAX_REFS } from '../../constants'
import type { Attachment } from '../../types'

type RefsProps = {
  refs: Attachment[]
  /** A 玩法 that needs the user's own photo, and none is attached yet. */
  needPhoto: boolean
  /** What photo the 玩法 wants. */
  photoHint?: string
  /** Image mode in a project: a 参考图 tile to add one. */
  showAdd: boolean
  onAdd: () => void
  onRemove: (id: string) => void
}

/** Thumbnails of the attached pictures, and the tile to add one. */
export function ComposerRefs(props: RefsProps) {
  const { t } = useTranslation()
  const addTile =
    !props.needPhoto && props.showAdd && props.refs.length < MAX_REFS
  if (!props.refs.length && !props.needPhoto && !addTile) return null
  return (
    <div className='bd-comp-refs'>
      {props.refs.map((r) => (
        <RefThumb key={r.id} att={r} onRemove={() => props.onRemove(r.id)} />
      ))}
      {props.needPhoto && (
        <Tip
          label={props.photoHint || t('This preset needs a photo of your own')}
        >
          <button
            type='button'
            className='bd-ref bd-ref-add bd-ref-need'
            onClick={props.onAdd}
          >
            <Upload aria-hidden='true' />
            <span>{t('Add your photo')}</span>
          </button>
        </Tip>
      )}
      {addTile && (
        <button
          type='button'
          className='bd-ref bd-ref-add'
          onClick={props.onAdd}
        >
          <ImagePlus aria-hidden='true' />
          <span>{t('Reference picture')}</span>
        </button>
      )}
    </div>
  )
}

function RefThumb(props: { att: Attachment; onRemove: () => void }) {
  const { t } = useTranslation()
  const url = useImageUrl(props.att.id, 'thumb')
  const label = props.att.label ? `@${props.att.label}` : ''
  return (
    <div className='bd-ref'>
      {url && <img src={url} alt={label || props.att.name || t('Picture')} />}
      {label && <span className='bd-ref-l'>{label}</span>}
      <button
        type='button'
        className='bd-ref-x'
        aria-label={t('Remove picture')}
        onClick={props.onRemove}
      >
        <X aria-hidden='true' />
      </button>
    </div>
  )
}
