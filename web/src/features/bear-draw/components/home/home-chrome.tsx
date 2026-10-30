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
import { ArrowUp } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { NightSkyCanvas } from '@/features/bear-chat/components/night-sky'
import { cn } from '@/lib/utils'

/** Where the sea starts, as a share of the page height (the prototype's). */
const HORIZON = 0.62

const reduced = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Dark theme: the night sky and sea behind the hero (the chat page's sky). */
export function HomeSky() {
  const wrap = useRef<HTMLDivElement>(null)
  // no boat on the home page, so no lantern on the water
  const bear = useRef<SVGSVGElement>(null)
  const horizon = useCallback(
    () => (wrap.current?.clientHeight ?? 0) * HORIZON,
    []
  )
  return (
    <div ref={wrap} className='bd-home-sky' aria-hidden='true'>
      <NightSkyCanvas
        horizon={horizon}
        bear={bear}
        still={reduced()}
        layoutKey='home'
      />
    </div>
  )
}

/** A small composer bar that appears once the big one has scrolled away. */
export function MiniComposer(props: { on: boolean; onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type='button'
      className={cn('bd-mini', props.on && 'bd-on')}
      aria-hidden={!props.on}
      tabIndex={props.on ? undefined : -1}
      onClick={props.onClick}
    >
      <span>{t('Tell the bear your design idea')}</span>
      <span className='bd-mini-go' aria-hidden='true'>
        <ArrowUp />
      </span>
    </button>
  )
}
