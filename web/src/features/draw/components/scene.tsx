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
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { useGlass } from '../hooks/use-glass'
import { useImageUrl } from '../hooks/use-image-url'
import { useNow } from '../hooks/use-now'
import { marksPath, pinPoint } from '../lib/marks'
import { formatClock, phase, type SceneSize } from '../lib/reveal'
import type { DrawItem, MarkStroke } from '../types'

/*
 * Waiting scenes. A new picture: the night sea from the home page, the boat
 * bobs in place and the waves drift past it, so nothing pretends to measure
 * progress. An edit: the original stays, frosted, a soft light passes over it
 * and the circled marks glow. Every loop is offset by --ph so a re-render
 * never restarts it.
 */

function Boat() {
  return (
    <svg viewBox='0 0 64 40' aria-hidden='true'>
      <path d='M7 27h50l-8 9H15z' fill='#d6a15a' />
      <path d='M31 5v22' stroke='#e9eef9' strokeWidth='1.8' />
      <path d='M32 6l16 18H32z' fill='#e9eef9' />
      <path d='M30 9 19 24h11z' fill='#c8d4f0' />
      <circle className='dw-lamp' cx='11' cy='23' r='2.4' fill='#ffd27a' />
    </svg>
  )
}

function SeaBody(props: { big: boolean }) {
  return (
    <>
      <span className='dw-sky' />
      <span className='dw-sky dw-s2' />
      {props.big && <span className='dw-shoot' />}
      <span className='dw-moon' />
      <span className='dw-water'>
        <span className='dw-wv dw-w1' />
        <span className='dw-wv dw-w2' />
        <span className='dw-wv dw-w3' />
        <span className='dw-wv dw-w4' />
      </span>
      <span className='dw-glint' />
      <span className='dw-boat'>
        <Boat />
        <span className='dw-refl'>
          <Boat />
        </span>
      </span>
    </>
  )
}

export function MarkGlow(props: { marks: MarkStroke[] | null; pins: boolean }) {
  if (!props.marks?.length) return null
  const d = marksPath(props.marks)
  return (
    <>
      {d && (
        <svg
          className='dw-mk-svg'
          viewBox='0 0 100 100'
          preserveAspectRatio='none'
          aria-hidden='true'
        >
          <path d={d} />
        </svg>
      )}
      {props.pins &&
        props.marks.map((s, i) => {
          const [u, v] = pinPoint(s)
          return (
            <span
              key={`${u}-${v}`}
              className='dw-pin'
              style={{
                left: `${(u * 100).toFixed(2)}%`,
                top: `${(v * 100).toFixed(2)}%`,
              }}
            >
              {i + 1}
            </span>
          )
        })}
    </>
  )
}

function FogBody(props: { item: DrawItem; big: boolean }) {
  const base = props.item.req.imgs.find((img) => img.kind === 'base')
  const url = useImageUrl(base?.id, 'thumb')
  return (
    <>
      {url && <img className='dw-fog-img' src={url} alt='' />}
      <span className='dw-veil' />
      <span className='dw-beam' />
      <MarkGlow marks={props.item.req.marks} pins={props.big} />
    </>
  )
}

/** Elapsed m:ss for a drawing picture. */
export function Elapsed(props: { item: DrawItem; className?: string }) {
  const now = useNow(props.item.status === 'pending')
  const secs =
    props.item.secs ?? Math.max(0, Math.floor((now - props.item.start) / 1000))
  return (
    <span className={cn('tabular-nums', props.className)} aria-live='off'>
      {formatClock(secs)}
    </span>
  )
}

export function SeaPill(props: {
  done: boolean
  word: string
  children?: ReactNode
}) {
  const glass = useGlass<HTMLSpanElement>({
    bezel: 18,
    depth: 9,
    frost: 2,
    tint: [0.12, 0.28],
    dark: true,
    tone: 'sea',
  })
  return (
    <span ref={glass} className='dw-sea-pill dw-glass'>
      <span className={cn('dw-dot', props.done && 'dw-ok')} />
      <b>{props.word}</b>
      {props.children}
    </span>
  )
}

type SceneProps = {
  item: DrawItem
  size: SceneSize
  /** The frozen copy that sits under a picture while it ripples in. */
  done?: boolean
  /** Shown under the pill on the canvas (wait hint, reminder link). */
  extra?: ReactNode
}

export function Scene(props: SceneProps) {
  const { t } = useTranslation()
  const [ph] = useState(phase)
  const edit = props.item.req.imgs.some((img) => img.kind === 'base')
  const big = props.size === 'big' || props.size === 'mid'
  let label: ReactNode = null
  if (big && props.done) {
    label = (
      <span className='dw-sea-c'>
        <SeaPill done word={edit ? t('Edited') : t('Done drawing')}>
          <Elapsed item={props.item} className='dw-t' />
        </SeaPill>
      </span>
    )
  } else if (big) {
    label = (
      <span className='dw-sea-c'>
        <SeaPill done={false} word={edit ? t('Editing') : t('Drawing now')}>
          <Elapsed item={props.item} className='dw-t' />
        </SeaPill>
        {props.extra}
      </span>
    )
  } else if (props.size === 'mini' && !props.done) {
    label = <Elapsed item={props.item} className='dw-tbadge' />
  }
  return (
    <span
      className={cn(
        'dw-scene',
        edit ? 'dw-fog' : 'dw-sea',
        `dw-${props.size}`,
        props.done && 'dw-rv-under'
      )}
      style={ph}
    >
      {edit ? <FogBody item={props.item} big={big} /> : <SeaBody big={big} />}
      {label}
    </span>
  )
}
