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
import '@/features/bear-chat/bear.css'
import '@/features/bear-chat/components/meteor.css'
import '../../css/bear-draw-bear.css'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { BearSvg } from '@/features/bear-chat/components/bear-svg'
import type { BearMood } from '@/features/bear-chat/types'
import { cn } from '@/lib/utils'

import { statusLabel } from './bear-work'
import { setBearMood } from './mood'
import type { DrawBearState } from './use-draw-bear'

/** Seconds since the run started, ticking twice a second while it works. */
function useSeconds(since: number, on: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [on, since])
  return Math.max(1, Math.round((now - since) / 1000))
}

/**
 * 「正在画 · 12 秒」 to the bear's left while the project works; just
 * 「等你回复」 while it waits for the user (no clock on their time).
 */
function StatusLine(props: { bear: DrawBearState }) {
  const { t } = useTranslation()
  const phase = props.bear.phase
  const counting = phase !== null && phase !== 'wait'
  const secs = useSeconds(props.bear.since, counting)
  const phaseSecs = useSeconds(props.bear.phaseSince, counting)
  if (!phase) {
    return (
      <span
        className={cn('bd-bear-stat', props.bear.stopped && 'bd-on')}
        role='status'
      >
        {props.bear.stopped ? t('Stopped') : ''}
      </span>
    )
  }
  // "still thinking" goes by how long this thought takes, not the whole run
  const label = statusLabel(t, phase, phase === 'think' ? phaseSecs : secs)
  return (
    <>
      <span className='bd-sr' role='status'>
        {label}
      </span>
      <span className='bd-bear-stat bd-on' aria-hidden='true'>
        <span className='bd-bear-shim'>{label}</span>
        {counting && (
          <>
            <span> · </span>
            <span className='bd-num'>{t('{{count}} s', { count: secs })}</span>
          </>
        )}
      </span>
    </>
  )
}

/**
 * The pixel bear on the composer's top-right rim (in its boat at night), its
 * status line, a right-click menu for a quieter bear, and what it says when
 * it has spotted meteors (home, plain dark).
 */
export function DrawBear(props: {
  bear: DrawBearState
  notice?: boolean
  hint?: boolean
  onNotice?: () => void
}) {
  const { t } = useTranslation()
  const bear = props.bear
  const director = bear.director
  // spotting meteors: a start
  const noticed = useRef(false)
  useEffect(() => {
    if (props.notice && !noticed.current) director?.show('startled')
    noticed.current = Boolean(props.notice)
  }, [props.notice, director])
  // the night sea just opened: into the boat
  const wasNight = useRef(bear.dark)
  useEffect(() => {
    const opened = bear.dark && !wasNight.current
    wasNight.current = bear.dark
    if (!opened) return
    const id = setTimeout(() => director?.show('drop'), 120)
    return () => clearTimeout(id)
  }, [bear.dark, director])
  return (
    <div
      ref={bear.perchRef}
      className={cn('bd-perch', bear.dark && 'bd-perch-night')}
      data-mood={bear.mood}
    >
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              type='button'
              className='bd-bear-btn'
              aria-label={t('The little bear')}
              onClick={() => {
                if (props.notice && !props.hint) props.onNotice?.()
                else director?.poke()
              }}
            />
          }
        >
          <BearSvg boat svgRef={bear.onSvg} />
        </ContextMenuTrigger>
        <ContextMenuContent className='bd-pop w-56 p-1.5'>
          <ContextMenuLabel>{t('The little bear')}</ContextMenuLabel>
          <ContextMenuRadioGroup
            value={bear.mood}
            onValueChange={(v) => setBearMood(v as BearMood)}
          >
            <ContextMenuRadioItem value='live'>
              {t('Lively')}
            </ContextMenuRadioItem>
            <ContextMenuRadioItem value='quiet'>
              {t('Quiet')}
            </ContextMenuRadioItem>
          </ContextMenuRadioGroup>
          <p className='bd-bear-note'>
            {t('Quiet: it only blinks and stops acting out the work.')}
          </p>
        </ContextMenuContent>
      </ContextMenu>
      <StatusLine bear={bear} />
      {props.notice && (
        <span className='bc-bear-mark' aria-hidden='true'>
          !
        </span>
      )}
      {props.hint && (
        <span className='bc-bear-tip' role='status'>
          {t('Look, a meteor! Click it to make a wish')} ✦
        </span>
      )}
    </div>
  )
}
