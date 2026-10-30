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
import type { ReactNode } from 'react'

import type { InterfaceLanguageCode } from '@/i18n/languages'
import { cn } from '@/lib/utils'

/*
 * Small flags for the language menu, drawn on a 30 × 20 grid. At menu size
 * the fine detail of the real flags would not show, so the stars are
 * simplified. 繁體中文 is written in more than one region, so it gets a
 * neutral 「繁」 text badge in the same slot instead of a regional flag.
 */

/** A five-point star centred on (cx, cy), one tip turned by `turn` degrees. */
function starPath(cx: number, cy: number, r: number, turn = 0): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.382
    const angle = ((turn - 90 + i * 36) * Math.PI) / 180
    return `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`
  })
  return `M${points.join('L')}Z`
}

const US_STARS = Array.from({ length: 20 }, (_, i) => ({
  x: 1.4 + (i % 5) * 2.3 + (Math.floor(i / 5) % 2) * 1.15,
  y: 1.3 + Math.floor(i / 5) * 2.4,
}))

const FLAGS: Record<Exclude<InterfaceLanguageCode, 'zhTW'>, ReactNode> = {
  zhCN: (
    <>
      <rect width='30' height='20' fill='#ee1c25' />
      <g fill='#ffde00'>
        <path d={starPath(5, 5, 3)} />
        <path d={starPath(10, 2, 1, 23)} />
        <path d={starPath(12, 4, 1, 46)} />
        <path d={starPath(12, 7, 1, 70)} />
        <path d={starPath(10, 9, 1, 21)} />
      </g>
    </>
  ),
  en: (
    <>
      <rect width='30' height='20' fill='#fff' />
      <path
        stroke='#b22234'
        strokeWidth='1.54'
        d='M0 .77h30M0 3.85h30M0 6.92h30M0 10h30M0 13.08h30M0 16.15h30M0 19.23h30'
      />
      <rect width='12' height='10.77' fill='#3c3b6e' />
      <g fill='#fff'>
        {US_STARS.map((dot) => (
          <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r='.42' />
        ))}
      </g>
    </>
  ),
  fr: (
    <>
      <rect width='30' height='20' fill='#fff' />
      <rect width='10' height='20' fill='#0055a4' />
      <rect x='20' width='10' height='20' fill='#ef4135' />
    </>
  ),
  ru: (
    <>
      <rect width='30' height='20' fill='#fff' />
      <rect y='6.67' width='30' height='6.67' fill='#0039a6' />
      <rect y='13.33' width='30' height='6.67' fill='#d52b1e' />
    </>
  ),
  ja: (
    <>
      <rect width='30' height='20' fill='#fff' />
      <circle cx='15' cy='10' r='6' fill='#bc002d' />
    </>
  ),
  vi: (
    <>
      <rect width='30' height='20' fill='#da251d' />
      <path d={starPath(15, 10, 6)} fill='#ffde00' />
    </>
  ),
}

const SLOT =
  'inline-flex h-3 w-[18px] shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/0.12)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.14)]'

export function LanguageFlag(props: { code: InterfaceLanguageCode }) {
  if (props.code === 'zhTW') {
    return (
      <span
        aria-hidden='true'
        data-flag={props.code}
        className={cn(
          SLOT,
          'bg-muted text-foreground items-center justify-center text-[9px] leading-none font-medium'
        )}
      >
        繁
      </span>
    )
  }
  // The span sets the size: menu items give any svg without a size- class
  // a 16px square.
  return (
    <span aria-hidden='true' data-flag={props.code} className={SLOT}>
      <svg viewBox='0 0 30 20' className='size-full'>
        {FLAGS[props.code]}
      </svg>
    </span>
  )
}
