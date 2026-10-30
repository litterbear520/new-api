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
import { ChevronsLeftRight } from 'lucide-react'
import { useState, type CSSProperties, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { useGlass } from '../hooks/use-glass'
import { useImageUrl } from '../hooks/use-image-url'
import type { DrawItem } from '../types'

/** Same size: one frame with a draggable split. Labels say before/after for an edit. */
export function CompareSlider(props: {
  left: DrawItem
  right: DrawItem
  leftLabel: string
  rightLabel: string
  w: number
  h: number
}) {
  const { t } = useTranslation()
  const [split, setSplit] = useState(50)
  const leftUrl = useImageUrl(props.left.img?.id, 'full')
  const rightUrl = useImageUrl(props.right.img?.id, 'full')
  const knob = useGlass<HTMLSpanElement>({
    bezel: 18,
    depth: 9,
    frost: 3,
    tint: [0.25, 0.4],
    dark: true,
  })
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setSplit(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)))
  }
  return (
    <div
      className='dw-frame dw-cmp'
      style={
        {
          width: props.w,
          height: props.h,
          '--split': `${split}%`,
        } as CSSProperties
      }
      role='slider'
      aria-label={t('Drag to compare')}
      aria-valuenow={Math.round(split)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setSplit((v) => Math.max(0, v - 5))
        if (e.key === 'ArrowRight') setSplit((v) => Math.min(100, v + 5))
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e)
      }}
    >
      {leftUrl && <img src={leftUrl} alt={props.leftLabel} draggable={false} />}
      {rightUrl && (
        <img
          className='dw-after'
          src={rightUrl}
          alt={props.rightLabel}
          draggable={false}
        />
      )}
      <span className='dw-handle'>
        <span ref={knob} className='dw-knob dw-glass'>
          <ChevronsLeftRight aria-hidden='true' />
        </span>
      </span>
      <span className='dw-cmp-l dw-l'>{props.leftLabel}</span>
      <span className='dw-cmp-l dw-r'>{props.rightLabel}</span>
    </div>
  )
}

/** Different sizes: side by side. */
export function ComparePair(props: {
  left: DrawItem
  right: DrawItem
  leftLabel: string
  rightLabel: string
  h: number
}) {
  const leftUrl = useImageUrl(props.left.img?.id, 'full')
  const rightUrl = useImageUrl(props.right.img?.id, 'full')
  const frame = (item: DrawItem, url: string | undefined, label: string) => {
    const ar = item.img ? item.img.w / item.img.h : 1
    return (
      <div>
        <div
          className='dw-frame'
          style={{
            width: Math.round(props.h * ar),
            height: Math.round(props.h),
          }}
        >
          {url && <img src={url} alt={label} draggable={false} />}
        </div>
        <div className='dw-tag-cap'>{label}</div>
      </div>
    )
  }
  return (
    <div className='dw-pair'>
      {frame(props.left, leftUrl, props.leftLabel)}
      {frame(props.right, rightUrl, props.rightLabel)}
    </div>
  )
}
