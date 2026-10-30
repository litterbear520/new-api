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
import { Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useDrawStore } from '@/stores/draw-store'

import { MARK_NUMBERS } from '../constants'
import { useImageUrl } from '../hooks/use-image-url'
import { detachBase, dropMark } from '../lib/actions'
import type { DrawAttachment, DrawRoom } from '../types'
import { Tip } from './tip'

function RemoveButton(props: { label: string; onClick: () => void }) {
  return (
    <Tip label={props.label}>
      <button
        type='button'
        className='dw-a-x'
        aria-label={props.label}
        onClick={props.onClick}
      >
        <X />
      </button>
    </Tip>
  )
}

function Thumb(props: { id: string; alt?: string }) {
  const url = useImageUrl(props.id, 'thumb')
  return url ? (
    <img src={url} alt={props.alt ?? ''} />
  ) : (
    <span className='dw-img-wait' />
  )
}

type AttachmentsProps = {
  room: DrawRoom
  list: DrawAttachment[]
  /** The canvas shows a picture that is still drawing and there is text to send. */
  showDrawingNote: boolean
  /** Folded canvas: the base picture is the one picked in the chat. */
  wide: boolean
  perImage: string
  onInsert: (text: string) => void
  onFocus: () => void
}

export function ComposerAttachments(props: AttachmentsProps) {
  const { t } = useTranslation()
  const many = props.list.length > 1
  if (!props.list.length && !props.showDrawingNote) return null
  const marks = props.room.mark?.strokes.length ?? 1

  return (
    <div className='dw-att'>
      {props.showDrawingNote && (
        <div className='dw-a-note'>
          <Info aria-hidden='true' />
          {t('This picture is still drawing; sending now draws a new one')}
        </div>
      )}
      {props.list.map((a, i) => {
        const no = many ? t('Image {{n}}, ', { n: i + 1 }) : ''
        if (a.kind === 'base') {
          return (
            <div key={a.id} className='dw-a-card'>
              <Thumb id={a.id} />
              <span className='dw-l'>
                <b>{t('Edit this one')}</b>
                <small>
                  {no}
                  {props.wide
                    ? t('the one you picked')
                    : t('the one on the canvas')}
                </small>
              </span>
              <RemoveButton
                label={t('Don’t edit this; draw a new one')}
                onClick={() => {
                  detachBase(props.room)
                  props.onFocus()
                }}
              />
            </div>
          )
        }
        if (a.kind === 'mark') {
          return (
            <Tip
              key={a.id}
              label={t(
                'The model is told to change only the circled areas; it may still touch other parts'
              )}
            >
              <div className='dw-a-card'>
                <Thumb id={a.id} />
                <span className='dw-l'>
                  <b>
                    {marks > 1
                      ? t('{{count}} areas circled', { count: marks })
                      : t('Circled area')}
                  </b>
                  {marks > 1 ? (
                    <span className='dw-mks'>
                      {Array.from({ length: marks }, (_, j) => (
                        <button
                          key={j}
                          type='button'
                          className='dw-mk'
                          aria-label={t('Insert number {{n}}', { n: j + 1 })}
                          onClick={() => props.onInsert(`${MARK_NUMBERS[j]} `)}
                        >
                          {j + 1}
                        </button>
                      ))}
                      <small>
                        {t('about {{price}} more', { price: props.perImage })}
                      </small>
                    </span>
                  ) : (
                    <small>
                      {no}
                      {t('about {{price}} more', { price: props.perImage })}
                    </small>
                  )}
                </span>
                <RemoveButton
                  label={t('Remove the circles')}
                  onClick={() => {
                    dropMark(props.room)
                    props.onFocus()
                  }}
                />
              </div>
            </Tip>
          )
        }
        return (
          <div key={a.id} className='dw-a-thumb'>
            <Thumb id={a.id} alt={a.name ?? t('Reference picture')} />
            {many && (
              <span className='dw-badge'>{t('Image {{n}}', { n: i + 1 })}</span>
            )}
            <RemoveButton
              label={t('Remove this picture')}
              onClick={() => {
                const s = useDrawStore.getState()
                s.setDraft({ refs: s.draft.refs.filter((r) => r.id !== a.id) })
                props.onFocus()
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
