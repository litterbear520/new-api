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
import { useTranslation } from 'react-i18next'

import earthDusk from '@/assets/overview/earth-dusk.webp'
import earthNight from '@/assets/overview/earth-night.webp'
import { toIntlLocale } from '@/i18n/languages'
import { cn } from '@/lib/utils'

import { money } from '../lib/money'
import type { WalletGauge } from '../lib/wallet'
import { BearMark } from './bear-mark'

/**
 * The balance card, the first tile of the overview's stat row: the night
 * Earth, the balance, one line under it and how much of the last top-up is
 * left. Running low swaps in the orbital sunset.
 */
export function WalletCard(props: {
  kind: 'new' | 'low' | 'active'
  balance: number
  gauge: WalletGauge
  /** The line under the balance: runway, gift note or "used up" */
  sub: ReactNode
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const low = props.kind === 'low'
  const percent = Math.round(props.gauge.left * 100)

  return (
    // .bo-compact: the stat-tile size of the card
    <div className={cn('bo-wallet bo-compact', low && 'bo-low')}>
      <div className='bo-scene' aria-hidden='true'>
        <img
          className='bo-earth'
          data-bar-backdrop='dark'
          src={low ? earthDusk : earthNight}
          alt=''
          decoding='async'
          draggable={false}
        />
        <div className='bo-film' />
      </div>
      <div className='bo-wtop'>
        <svg viewBox='0 0 24 24' aria-hidden='true'>
          <BearMark />
        </svg>
        {t('Balance')}
      </div>
      <div className='bo-amt'>{money(props.balance, locale)}</div>
      <div className='bo-wsub'>{props.sub}</div>
      <div className='bo-wm'>
        <div className='bo-wrow'>
          <div
            className='bo-wbar'
            role='meter'
            aria-label={t('Balance left')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <i style={{ width: `${percent}%` }} />
          </div>
          <b>{t('{{percent}}% left', { percent })}</b>
        </div>
      </div>
    </div>
  )
}
