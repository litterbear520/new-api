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
import { ChevronDown, Ratio as RatioIcon } from 'lucide-react'
import { useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tip } from '@/features/draw/components/tip'

import type { Ratio } from '../../types'

/** The prototype's order: squares and portraits first, 自动 last. */
const GRID: Ratio[] = [
  '1:1',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
  '2:3',
  '3:2',
  'auto',
]

/** The ratio as a small outlined frame, `long` px on its long side. */
function Shape(props: { ratio: Exclude<Ratio, 'auto'>; long: number }) {
  const [w, h] = props.ratio.split(':').map(Number)
  const k = props.long / Math.max(w, h)
  return (
    <span className='bd-set-shape' aria-hidden='true'>
      <i style={{ width: w * k, height: h * k }} />
    </span>
  )
}

/**
 * The ratio of this message's pictures. 自动 leaves it to the planner; a
 * picked ratio shows on the chip until the message is sent.
 */
export function RatioMenu(props: {
  ratio: Ratio
  onChange: (ratio: Ratio) => void
  /** Where the focus goes when the panel closes (the textarea). */
  finalFocus: RefObject<HTMLTextAreaElement | null>
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ratio = props.ratio
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label={t('Aspect ratio')}>
        <PopoverTrigger
          render={
            <button
              type='button'
              className='bd-chip bd-ratio-chip'
              data-set={ratio === 'auto' ? undefined : ''}
              aria-label={
                ratio === 'auto'
                  ? t('Aspect ratio')
                  : `${t('Aspect ratio')} ${ratio}`
              }
            >
              {ratio === 'auto' ? (
                <>
                  <RatioIcon aria-hidden='true' />
                  {t('Aspect ratio')}
                </>
              ) : (
                <>
                  <Shape ratio={ratio} long={14} />
                  <b>{ratio}</b>
                </>
              )}
              <ChevronDown className='bd-chev' aria-hidden='true' />
            </button>
          }
        />
      </Tip>
      <PopoverContent
        side='top'
        align='start'
        sideOffset={8}
        finalFocus={props.finalFocus}
        className='bd-pop bd-set w-[min(336px,calc(100vw-24px))]'
      >
        <div className='bd-set-r' role='group' aria-label={t('Aspect ratio')}>
          {GRID.map((r) => (
            <button
              key={r}
              type='button'
              aria-pressed={ratio === r}
              onClick={() => {
                props.onChange(r)
                setOpen(false)
              }}
            >
              {r === 'auto' ? (
                <span className='bd-set-auto'>{t('Auto')}</span>
              ) : (
                <>
                  <Shape ratio={r} long={18} />
                  <span>{r}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
