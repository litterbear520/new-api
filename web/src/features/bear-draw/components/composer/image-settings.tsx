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
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/features/draw/components/tip'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { MAX_COUNT } from '../../constants'
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
const COUNTS = Array.from({ length: MAX_COUNT }, (_, i) => i + 1)

/** The ratio as a small outlined frame, 18 px on its long side. */
function Shape(props: { ratio: Exclude<Ratio, 'auto'> }) {
  const [w, h] = props.ratio.split(':').map(Number)
  const k = 18 / Math.max(w, h)
  return (
    <span className='bd-set-shape' aria-hidden='true'>
      <i style={{ width: w * k, height: h * k }} />
    </span>
  )
}

/** Image mode: 「1:1 · 1 张」 → ratio, how many, transparent background. */
export function ImageSettings(props: {
  /** This message's rough cost, formatted; null when unknown. */
  cost: string | null
}) {
  const { t } = useTranslation()
  const ratio = useBearDrawStore((s) => s.prefs.ratio)
  const count = useBearDrawStore((s) => s.prefs.count)
  const transparent = useBearDrawStore((s) => s.prefs.transparent)
  const setPrefs = useBearDrawStore((s) => s.setPrefs)
  const ratioLabel = ratio === 'auto' ? t('Auto') : ratio
  return (
    <Popover>
      <Tip label={t('Image settings')}>
        <PopoverTrigger
          render={
            <button type='button' className='bd-chip bd-set-chip'>
              {ratioLabel} · {t('×{{count}}', { count })}
              <ChevronDown className='bd-chev' aria-hidden='true' />
            </button>
          }
        />
      </Tip>
      <PopoverContent
        side='top'
        align='start'
        sideOffset={8}
        className='bd-pop bd-set w-[min(336px,calc(100vw-24px))]'
      >
        <div className='bd-set-t'>{t('Image settings')}</div>
        <div className='bd-set-l'>{t('Aspect ratio')}</div>
        <div className='bd-set-r' role='group' aria-label={t('Aspect ratio')}>
          {GRID.map((r) => (
            <button
              key={r}
              type='button'
              aria-pressed={ratio === r}
              onClick={() => setPrefs({ ratio: r })}
            >
              {r === 'auto' ? (
                <span className='bd-set-auto'>{t('Auto')}</span>
              ) : (
                <>
                  <Shape ratio={r} />
                  <span>{r}</span>
                </>
              )}
            </button>
          ))}
        </div>
        <div className='bd-set-l'>{t('How many')}</div>
        <div className='bd-set-n' role='group' aria-label={t('How many')}>
          {COUNTS.map((n) => (
            <button
              key={n}
              type='button'
              aria-pressed={count === n}
              onClick={() => setPrefs({ count: n })}
            >
              {t('×{{count}}', { count: n })}
            </button>
          ))}
        </div>
        <div className='bd-set-sw'>
          <span>
            <span>{t('Transparent background')}</span>
            <small>
              {t('A PNG with no background, for stickers and cut-outs')}
            </small>
          </span>
          <Switch
            checked={transparent}
            aria-label={t('Transparent background')}
            onCheckedChange={(c) => setPrefs({ transparent: c })}
          />
        </div>
        {props.cost && (
          <div className='bd-set-foot'>
            {t('About {{cost}} this time; nothing is charged if it fails', {
              cost: props.cost,
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
