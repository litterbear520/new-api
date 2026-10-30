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
import { useEffect, useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useBearChatStore } from '@/stores/bear-chat-store'

import { WORK_STATUS } from '../constants'
import type { BearState } from '../hooks/use-bear'
import type { BearMood } from '../types'
import { BearSvg } from './bear-svg'

type BearPerchProps = {
  bear: BearState
  perchRef: Ref<HTMLDivElement>
  onSvg: (svg: SVGSVGElement | null) => void
  /** A meteor is in the sky: an exclamation mark over the bear. */
  notice?: boolean
  /** The bear was clicked about it: a tip to wish on it. */
  hint?: boolean
  onNotice?: () => void
}

/** Seconds since the reply started, ticking twice a second while it works. */
function useSeconds(since: number, on: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [on, since])
  return Math.max(1, Math.round((now - since) / 1000))
}

function StatusLine(props: { bear: BearState }) {
  const { t } = useTranslation()
  const work = props.bear.work
  const secs = useSeconds(props.bear.workSince, work !== null)
  if (props.bear.stopped) {
    return <span className='bc-stat bc-on'>{t('Stopped')}</span>
  }
  if (!work) return <span className='bc-stat' aria-hidden='true' />
  let label = t(WORK_STATUS[work] ?? 'Writing')
  // the longer it thinks, the plainer the words (Claude Code: 10 s, 45 s)
  if (work === 'think' || work === 'phones' || work === 'wand') {
    if (secs >= 60) label = t('Seems stuck; you can stop and try again')
    else if (secs >= 45) label = t('Deep in thought')
    else if (secs >= 10 && work === 'think') label = t('Still thinking')
  }
  return (
    <span className='bc-stat bc-on' aria-live='polite'>
      <span className='bc-shim'>{label}</span>
      <span aria-hidden='true'> · </span>
      <span className='tabular-nums'>{t('{{count}} s', { count: secs })}</span>
    </span>
  )
}

/** Lively / quiet / hidden. */
function MoodItems() {
  const { t } = useTranslation()
  const mood = useBearChatStore((s) => s.settings.mood)
  const setSettings = useBearChatStore((s) => s.setSettings)
  return (
    <ContextMenuRadioGroup
      value={mood}
      onValueChange={(v) => setSettings({ mood: v as BearMood })}
    >
      <ContextMenuRadioItem value='live'>{t('Lively')}</ContextMenuRadioItem>
      <ContextMenuRadioItem value='quiet'>{t('Quiet')}</ContextMenuRadioItem>
      <ContextMenuRadioItem value='hide'>
        {t('Bear hidden')}
      </ContextMenuRadioItem>
    </ContextMenuRadioGroup>
  )
}

/**
 * The bear on the composer's rim, its status line, its right-click menu, and
 * what it says when it has spotted a meteor.
 */
export function BearPerch(props: BearPerchProps) {
  const { t } = useTranslation()
  const director = props.bear.director
  return (
    <div ref={props.perchRef} className='bc-perch'>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              type='button'
              className='bc-bear-btn'
              aria-label={t('The little bear')}
              onClick={() => {
                if (props.notice && !props.hint) props.onNotice?.()
                else director?.poke()
              }}
            />
          }
        >
          <BearSvg boat svgRef={props.onSvg} />
        </ContextMenuTrigger>
        <ContextMenuContent className='w-56 p-1.5'>
          <ContextMenuLabel>{t('The little bear')}</ContextMenuLabel>
          <MoodItems />
          <p className='bc-menu-note'>
            {t('Quiet: it only blinks and stops acting out the work.')}
          </p>
        </ContextMenuContent>
      </ContextMenu>
      <StatusLine bear={props.bear} />
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
