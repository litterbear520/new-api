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

import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import { money } from '../lib/money'
import type { UsageSummary } from '../lib/usage'
import { InfoTip } from './info-tip'

/** Today's spend is flagged once it passes 1.5 usual days. */
const HOT_FACTOR = 1.5

/** Days counted on the requests card */
const REQUEST_DAYS = 7

/**
 * The overview's stat row: the wallet card first, then today's spend, this
 * month's spend and the last 7 days' requests.
 */
export function StatCards(props: {
  summary: UsageSummary
  now: Date
  wallet: ReactNode
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const today = props.summary.todayQuota
  const usual = props.summary.perDayQuota
  const time = props.now.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
  const month = props.now.toLocaleDateString(locale, { month: 'short' })
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })

  let todaySub = t('No spend in the last 7 days')
  if (usual > 0 && today > usual) {
    todaySub = t('{{percent}} above your daily average', {
      percent: percent.format(today / usual - 1),
    })
  } else if (usual > 0) {
    todaySub = t('Daily average {{amount}}', { amount: money(usual, locale) })
  }
  const scale = Math.max(today, usual) * 1.25 || 1
  const requests = props.summary.days
    .slice(-REQUEST_DAYS)
    .reduce((sum, day) => sum + day.requests, 0)

  return (
    <div className='bo-stats'>
      {props.wallet}
      <section className='bo-card bo-c' aria-labelledby='bo-today-title'>
        <div className='bo-c-h'>
          <h2 id='bo-today-title'>{t("Today's spend")}</h2>
          <InfoTip
            text={t(
              'From midnight to now. The tick marks your average day over the last 7 days.'
            )}
          />
          <span className='bo-chip'>{t('As of {{time}}', { time })}</span>
        </div>
        <div className='bo-v'>{money(today, locale)}</div>
        <div className='bo-s'>{todaySub}</div>
        <div
          className='bo-bullet'
          role='img'
          aria-label={t('Today {{today}}, daily average {{average}}', {
            today: money(today, locale),
            average: money(usual, locale),
          })}
        >
          <i
            className={cn(
              today > usual * HOT_FACTOR && usual > 0 && 'bo-hot-bar'
            )}
            style={{ width: `${(today / scale) * 100}%` }}
          />
          {usual > 0 && (
            <b style={{ left: `${(usual / scale) * 100}%` }}>
              <span>{t('Daily avg')}</span>
            </b>
          )}
        </div>
      </section>

      <section className='bo-card bo-c' aria-labelledby='bo-month-title'>
        <div className='bo-c-h'>
          <h2 id='bo-month-title'>{t('Spend this month')}</h2>
          <span className='bo-chip'>{month}</span>
        </div>
        <div className='bo-v'>{money(props.summary.monthQuota, locale)}</div>
        <div className='bo-s'>
          {t('Projected {{amount}} by month end', {
            amount: money(props.summary.monthEndQuota, locale),
          })}
        </div>
      </section>

      <section className='bo-card bo-c' aria-labelledby='bo-req-title'>
        <div className='bo-c-h'>
          <h2 id='bo-req-title'>{t('Requests, last 7 days')}</h2>
        </div>
        <div className='bo-v'>{formatNumber(requests, locale)}</div>
        <div className='bo-s'>
          {t('Daily average {{amount}}', {
            amount: formatNumber(Math.round(requests / REQUEST_DAYS), locale),
          })}
        </div>
      </section>
    </div>
  )
}
