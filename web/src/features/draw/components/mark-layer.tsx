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
import { useEffect, useRef, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { MARK_NUMBERS } from '../constants'
import { drawStrokes } from '../lib/marks'
import type { MarkStroke } from '../types'

type MarkLayerProps = {
  strokes: MarkStroke[]
  onChange: (strokes: MarkStroke[]) => void
  /** Rendered size of the picture in CSS px. */
  w: number
  h: number
}

/** 圈选: free-hand red circles on the picture, kept in picture coordinates. */
export function MarkLayer(props: MarkLayerProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<MarkStroke | null>(null)
  const strokes = useRef(props.strokes)
  strokes.current = props.strokes

  const paint = (list: MarkStroke[]) => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    drawStrokes(ctx, c.width, c.height, list)
  }

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.round(props.w * dpr)
    c.height = Math.round(props.h * dpr)
    paint(strokes.current)
  }, [props.w, props.h])

  useEffect(() => paint(props.strokes), [props.strokes])

  const point = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect()
    const clamp = (v: number) => Math.min(1, Math.max(0, v))
    return [
      clamp((e.clientX - r.left) / r.width),
      clamp((e.clientY - r.top) / r.height),
    ]
  }

  return (
    <canvas
      ref={ref}
      className='dw-ink'
      aria-label={t('Draw circles on the picture')}
      onPointerDown={(e) => {
        e.preventDefault()
        if (strokes.current.length >= MARK_NUMBERS.length) {
          toast(t('Up to {{count}} areas', { count: MARK_NUMBERS.length }))
          return
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        drawing.current = [point(e)]
        paint([...strokes.current, drawing.current])
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return
        drawing.current.push(point(e))
        paint([...strokes.current, drawing.current])
      }}
      onPointerUp={() => {
        if (!drawing.current) return
        const s = drawing.current
        drawing.current = null
        props.onChange([...strokes.current, s])
      }}
      onPointerCancel={() => {
        drawing.current = null
        paint(strokes.current)
      }}
    />
  )
}
