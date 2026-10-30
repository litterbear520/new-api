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
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { cn } from '@/lib/utils'

import { REVEAL_MS } from '../constants'
import { useImageUrl } from '../hooks/use-image-url'
import { revealOrigins, revealStyles, type SceneSize } from '../lib/reveal'
import type { DrawItem } from '../types'
import { Scene } from './scene'

type RevealImageProps = {
  item: DrawItem
  /** When the ripple started; no ripple once REVEAL_MS has passed. */
  revealAt?: number
  size: SceneSize
  variant: 'full' | 'thumb'
  /** Rendered size in px, for the ripple geometry. */
  w: number
  h: number
  /** The warped bright copy riding the front (large pictures only). */
  rim?: boolean
  alt?: string
  className?: string
}

/** A finished picture; right after it arrives it ripples out of one point. */
export function RevealImage(props: RevealImageProps) {
  const url = useImageUrl(props.item.img?.id, props.variant)
  const [, setTick] = useState(0)
  const left = props.revealAt ? REVEAL_MS - (Date.now() - props.revealAt) : -1
  const active = left > 0 && Boolean(url)

  useEffect(() => {
    if (!props.revealAt) return
    const rest = REVEAL_MS - (Date.now() - props.revealAt)
    if (rest <= 0) return
    const id = setTimeout(() => setTick((n) => n + 1), rest + 60)
    return () => clearTimeout(id)
  }, [props.revealAt])

  // fixed while it plays, so re-renders don't restart the ripple
  const delay = useMemo(
    () =>
      props.revealAt
        ? `${(-(Date.now() - props.revealAt) / 1000).toFixed(3)}s`
        : '0s',
    [props.revealAt]
  )
  const styles = useMemo(
    () =>
      revealStyles(
        revealOrigins(props.item, props.w, props.h, props.size),
        props.w,
        props.h
      ),
    [props.item, props.w, props.h, props.size]
  )

  if (!url) return <span className='dw-img-wait' aria-hidden='true' />
  if (!active) {
    return (
      <img
        className={props.className}
        src={url}
        alt={props.alt ?? ''}
        decoding='async'
        draggable={false}
      />
    )
  }
  return (
    <span className='dw-revealing' style={{ '--rd': delay } as CSSProperties}>
      <img
        className={cn('dw-rv-main', props.className)}
        src={url}
        alt={props.alt ?? ''}
        style={styles.main}
        draggable={false}
      />
      {props.rim && (
        <img
          className='dw-rv-rim'
          src={url}
          alt=''
          style={styles.rim}
          aria-hidden='true'
        />
      )}
      <Scene item={props.item} size={props.size} done />
      <span className='dw-rv-ring' style={styles.ring} />
    </span>
  )
}
