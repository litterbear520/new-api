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
import { BookOpen, CircleDashed, ImagePlus, SwatchBook } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useImageUrl } from '@/features/draw/hooks/use-image-url'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { IMAGE_MODEL_META } from '../../constants'
import { skillById } from '../../data/skills'
import type { Attachment, UserMessage as UserMessageData } from '../../types'

function useSkillName(id: string | undefined): string | null {
  const mine = useBearDrawStore((s) =>
    id ? (s.mySkills.find((x) => x.id === id)?.name ?? null) : null
  )
  if (!id) return null
  return skillById(id)?.name ?? mine
}

/** A picture sent with the message; canvas pictures keep their @name. */
function RefThumb(props: { attachment: Attachment }) {
  const { t } = useTranslation()
  const a = props.attachment
  const url = useImageUrl(a.id, 'thumb')
  const name = a.label ? `@${a.label}` : (a.name ?? t('Reference'))
  return (
    <span className='bd-u-ref' title={name}>
      {url ? <img src={url} alt={name} /> : <span className='bd-u-ref-wait' />}
      {(a.label || a.marked) && (
        <span className='bd-u-ref-tag'>
          {a.marked && <CircleDashed aria-hidden='true' />}
          {a.label ? `@${a.label}` : t('Circled')}
        </span>
      )}
    </span>
  )
}

/** 「图像 · Sunburst · 4:3 · 2 张」, the brand kit, a 玩法 card. */
function ModeLine(props: { message: UserMessageData }) {
  const { t } = useTranslation()
  const m = props.message
  const bits: string[] = []
  if (m.mode === 'image' && m.image) {
    const img = m.image
    bits.push(
      t('Image mode'),
      IMAGE_MODEL_META[img.model]?.short ?? img.model,
      img.ratio === 'auto' ? t('Any ratio') : img.ratio,
      t('×{{count}}', { count: img.count })
    )
    if (img.transparent) bits.push(t('Transparent background'))
  }
  if (m.brand) bits.push(t('Brand kit applied'))
  if (m.presetId) bits.push(t('From the gallery'))
  if (!bits.length) return null
  const Icon = m.mode === 'image' ? ImagePlus : SwatchBook
  return (
    <span className='bd-u-mode'>
      <Icon aria-hidden='true' />
      {bits.join(' · ')}
    </span>
  )
}

/** What the user sent: pictures above, then the bubble. */
export function UserMessage(props: { message: UserMessageData }) {
  const m = props.message
  const skill = useSkillName(m.skillId)
  const hasBubble = Boolean(m.text || skill || m.image || m.brand || m.presetId)
  return (
    <div className='bd-u'>
      {m.refs.length > 0 && (
        <div className='bd-u-refs'>
          {m.refs.map((r) => (
            <RefThumb key={r.id} attachment={r} />
          ))}
        </div>
      )}
      {hasBubble && (
        <div className='bd-u-b'>
          {skill && (
            <span className='bd-u-skill'>
              <BookOpen aria-hidden='true' />
              {skill}
            </span>
          )}
          {m.text && <span className='bd-u-t'>{m.text}</span>}
          <ModeLine message={m} />
        </div>
      )}
    </div>
  )
}
