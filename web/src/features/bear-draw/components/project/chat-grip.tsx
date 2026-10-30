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
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react'
import { useTranslation } from 'react-i18next'

import { CHAT_W } from '../../constants'
import { clampChatWidth } from './chat-width'

const STEP = 16

/**
 * The line between the chat and the canvas: drag it (or use the arrow
 * keys) to make the chat 320–560 px wide. While dragging, the width is
 * written straight onto the page so nothing re-renders per pixel.
 */
export function ChatGrip(props: {
  width: number
  /** The element that holds the --chat-w variable. */
  target: RefObject<HTMLElement | null>
  onDragging: (on: boolean) => void
  onChange: (px: number) => void
}) {
  const { t } = useTranslation()

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const x0 = e.clientX
    const w0 = props.width
    let w = w0
    props.onDragging(true)
    const move = (ev: PointerEvent) => {
      w = clampChatWidth(w0 + ev.clientX - x0)
      props.target.current?.style.setProperty('--chat-w', `${w}px`)
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      props.onDragging(false)
      props.onChange(w)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null
    if (e.key === 'ArrowLeft') next = props.width - STEP
    else if (e.key === 'ArrowRight') next = props.width + STEP
    else if (e.key === 'Home') next = CHAT_W.min
    else if (e.key === 'End') next = CHAT_W.max
    if (next == null) return
    e.preventDefault()
    props.onChange(clampChatWidth(next))
  }

  return (
    <div
      className='bd-grip'
      role='separator'
      aria-orientation='vertical'
      aria-label={t('Drag to change the width of the chat')}
      aria-valuemin={CHAT_W.min}
      aria-valuemax={CHAT_W.max}
      aria-valuenow={props.width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  )
}
