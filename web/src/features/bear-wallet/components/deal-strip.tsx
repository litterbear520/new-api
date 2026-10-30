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
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'

import { usd } from '../lib/format'
import { percent, yuan, type BonusTier, type Quote } from '../lib/rules'
import { GiftIcon } from './gift-icon'

/**
 * One line on the page with the deals that live in the top-up dialog, so
 * they are seen without opening it. The whole line opens the dialog; the
 * link under it leads to the public 活动 page with every offer.
 */
export function DealStrip(props: {
  starter: { quote: Quote } | null
  tiers: BonusTier[]
  onOpen: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  if (!props.starter && !props.tiers.length) return null

  const rates = props.tiers.map((tier) => tier.rate)
  const tierText = props.tiers.length
    ? t('Single payments from {{min}} get {{low}}–{{max}}% bonus', {
        min: yuan(props.tiers[0].min, locale),
        low: percent(Math.min(...rates)),
        max: percent(Math.max(...rates)),
      })
    : null

  return (
    <>
      <button
        type='button'
        className={props.starter ? 'bw-deal bw-deal-gift' : 'bw-deal'}
        onClick={props.onOpen}
      >
        {props.starter && <GiftIcon className='bw-deal-ic' />}
        <span className='bw-deal-text'>
          {props.starter && (
            <span>
              <Trans
                i18nKey='<b>Starter pack</b>: pay {{pay}}, get {{amount}}, once per account'
                values={{
                  pay: yuan(props.starter.quote.pay, locale),
                  amount: usd(
                    props.starter.quote.amount + props.starter.quote.bonus,
                    locale
                  ),
                }}
                components={{ b: <b /> }}
              />
            </span>
          )}
          {tierText && <span className='bw-deal-tiers'>{tierText}</span>}
        </span>
        <span className='bw-deal-go'>
          {t('Go to top up')}
          <ChevronRight aria-hidden='true' />
        </span>
      </button>
      <Link to='/activity' className='bw-deal-more'>
        {t('All offers')}
        <ChevronRight aria-hidden='true' />
      </Link>
    </>
  )
}
