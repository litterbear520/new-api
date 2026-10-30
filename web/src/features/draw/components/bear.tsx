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
import { useState, type CSSProperties } from 'react'

import { cn } from '@/lib/utils'

import { phase } from '../lib/reveal'

/*
 * The jumping bear from the logo package (crouch, launch, apex, squash,
 * rebound; ears bounce, arms wave). It hops in front of the status while a
 * picture draws, cheers once when one is ready, and stands still otherwise.
 */

function BearSvg() {
  return (
    <svg className='dw-kb' viewBox='-2 -5 28 28' aria-hidden='true'>
      <ellipse
        className='dw-kb-shadow'
        cx='12'
        cy='21.35'
        rx='7.5'
        ry='.85'
        fill='currentColor'
        fillOpacity='.18'
      />
      <g className='dw-kb-hop'>
        <path
          className='dw-kb-arm-l'
          d='M0 11.95H3.6V15.05H0Z'
          fill='#D97757'
        />
        <path
          className='dw-kb-arm-r'
          d='M20.4 11.95H24V15.05H20.4Z'
          fill='#D97757'
        />
        <g className='dw-kb-ear-l'>
          <path d='M3 4.5H4.5V3H7.5V4.5H9V6.3H3Z' fill='#D97757' />
          <path d='M4.5 4.5H7.5V6H4.5Z' fill='#EFA585' />
        </g>
        <g className='dw-kb-ear-r'>
          <path d='M15 4.5H16.5V3H19.5V4.5H21V6.3H15Z' fill='#D97757' />
          <path d='M16.5 4.5H19.5V6H16.5Z' fill='#EFA585' />
        </g>
        <path
          d='M3 6H21V18.08H19.5V21H16.5V18.08H7.5V21H4.5V18.08H3Z'
          fill='#D97757'
        />
        <path d='M9.75 11.95H14.25V15.05H9.75Z' fill='#FBE9DA' />
        <path d='M10.875 11.95H13.125V13.3H10.875Z' fill='#1F1A17' />
        <path
          className='dw-kb-eyes'
          d='M6 9.1H7.488V11.95H6ZM16.51 9.1H18V11.95H16.51Z'
          fill='#1F1A17'
        />
      </g>
    </svg>
  )
}

type BearProps = {
  mode: 'hop' | 'cheer' | 'still'
  className?: string
  /** For a cheer: how far into the hop it already is, in seconds. */
  cheerAt?: number
}

export function Bear(props: BearProps) {
  // computed once: a new delay on every render would make the hop jump
  const [ph] = useState(phase)
  const [cd] = useState(() => `${(-(props.cheerAt ?? 0)).toFixed(3)}s`)
  let style: CSSProperties | undefined
  if (props.mode === 'hop') style = ph
  if (props.mode === 'cheer') style = { '--cd': cd } as CSSProperties
  return (
    <span
      className={cn(
        props.className,
        props.mode === 'hop' && 'dw-hopping',
        props.mode === 'cheer' && 'dw-cheer'
      )}
      style={style}
      aria-hidden='true'
    >
      <BearSvg />
    </span>
  )
}

/** Clicking or hovering makes it hop once (start page). */
export function PokeBear(props: { label: string }) {
  const poke = (el: HTMLElement) => {
    el.classList.remove('dw-cheer')
    el.style.removeProperty('--cd')
    void el.offsetWidth
    el.classList.add('dw-cheer')
  }
  return (
    <button
      type='button'
      className='dw-kb-btn dw-cheer'
      style={{ '--cd': '.35s' } as CSSProperties}
      aria-label={props.label}
      onClick={(e) => poke(e.currentTarget)}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') poke(e.currentTarget)
      }}
    >
      <BearSvg />
    </button>
  )
}
