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
import { BookOpen, ImageIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useImageUrl } from '@/features/draw/hooks/use-image-url'

import { pickerPlacement, type PickPlacement } from './placement'
import type { TriggerKind } from './trigger'
import type { PickItem } from './use-picker'

type PickerProps = {
  /** id of the listbox; options are `${id}-${index}`. */
  id: string
  kind: TriggerKind
  items: PickItem[]
  active: number
  /** "@": the canvas has finished pictures at all. */
  hasPictures: boolean
  onChoose: (item: PickItem) => void
  onHover: (index: number) => void
}

/**
 * The list by the box while "/" or "@" is typed (above it when there is
 * room). The textarea keeps the focus and drives it (aria-activedescendant);
 * a click picks without blur.
 */
export function ComposerPicker(props: PickerProps) {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<PickPlacement | null>(null)
  const skill = props.kind === 'skill'
  const title = skill ? t('Which skill?') : t('Use a picture from the canvas')

  // measured once per opening, before it paints
  useLayoutEffect(() => {
    const composer = rootRef.current?.parentElement
    if (composer) setPlace(pickerPlacement(composer))
  }, [])

  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [props.active, props.items])

  let empty = ''
  if (!props.items.length) {
    if (skill) empty = t('No matching skill')
    else if (props.hasPictures) empty = t('No matching picture')
    else empty = t('No pictures on the canvas yet')
  }

  return (
    <div
      ref={rootRef}
      className='bd-pick'
      data-side={place?.side ?? 'top'}
      style={place ? { maxHeight: place.max } : undefined}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className='bd-pick-h'>
        <span>{title}</span>
        <span className='bd-muted'>{t('↑↓ to choose · Enter to pick')}</span>
      </div>
      {empty && <div className='bd-pick-empty'>{empty}</div>}
      <div
        ref={listRef}
        id={props.id}
        role='listbox'
        aria-label={title}
        className='bd-pick-list'
      >
        {props.items.map((item, i) => (
          <div
            key={item.key}
            id={`${props.id}-${i}`}
            role='option'
            aria-selected={i === props.active}
            className='bd-pick-i'
            onClick={() => props.onChoose(item)}
            onMouseMove={() => props.onHover(i)}
          >
            <PickRow item={item} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PickRow(props: { item: PickItem }) {
  const { t } = useTranslation()
  const item = props.item
  if (item.kind === 'skill') {
    const cover = item.skill.covers[0]
    return (
      <>
        <span className='bd-pick-th' aria-hidden='true'>
          {cover ? <img src={cover} alt='' /> : <BookOpen />}
        </span>
        <span className='bd-pick-m'>
          <b>
            {item.skill.name}
            {item.mine && <em className='bd-tag'>{t('Mine')}</em>}
          </b>
          <span>{item.skill.tagline}</span>
        </span>
      </>
    )
  }
  return (
    <>
      <CanvasThumb id={item.pick.node.img?.id} />
      <span className='bd-pick-m'>
        <b>{item.pick.label}</b>
        {item.pick.group && <span>{item.pick.group}</span>}
      </span>
    </>
  )
}

function CanvasThumb(props: { id?: string }) {
  const url = useImageUrl(props.id, 'thumb')
  return (
    <span className='bd-pick-th' aria-hidden='true'>
      {url ? <img src={url} alt='' /> : <ImageIcon />}
    </span>
  )
}
