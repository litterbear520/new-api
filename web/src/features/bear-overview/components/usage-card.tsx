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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber, formatNumber } from '@/lib/format'

import { FAMILY_LABELS, STORAGE_KEYS, type FamilyKey } from '../constants'
import { useStoredState } from '../hooks/use-stored-state'
import { axisMoney, money, quotaPerUnit } from '../lib/money'
import type { UsageSummary } from '../lib/usage'
import { InfoTip } from './info-tip'
import { Segmented } from './segmented'
import { UsageChart, type ChartDay } from './usage-chart'

type Metric = 'spend' | 'tokens'
type Range = '7' | '30'

export function UsageCard(props: { summary: UsageSummary; now: Date }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [metric, setMetric] = useStoredState<Metric>(
    STORAGE_KEYS.metric,
    'spend',
    ['spend', 'tokens']
  )
  const [range, setRange] = useStoredState<Range>(STORAGE_KEYS.range, '7', [
    '7',
    '30',
  ])
  const dayCount = range === '7' ? 7 : 30
  const families: FamilyKey[] = props.summary.families.length
    ? props.summary.families
    : ['gpt']
  const time = props.now.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })

  const days = useMemo<ChartDay[]>(() => {
    const shown = props.summary.days.slice(-dayCount)
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    const longDate = new Intl.DateTimeFormat(locale, {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
    const shortDate = new Intl.DateTimeFormat(locale, {
      month: 'numeric',
      day: 'numeric',
    })
    return shown.map((day, index) => {
      const date = new Date(day.start * 1000)
      const today = index === shown.length - 1
      let tick = ''
      if (today) tick = t('Today')
      else if (dayCount === 7) tick = weekday.format(date)
      else if ((shown.length - 1 - index) % 7 === 0) {
        tick = shortDate.format(date)
      }
      return {
        label: today
          ? t('Today, as of {{time}}', { time })
          : longDate.format(date),
        tick,
        today,
        values: metric === 'spend' ? day.quota : day.tokens,
      }
    })
  }, [dayCount, locale, metric, props.summary.days, t, time])

  const shownDays = props.summary.days.slice(-dayCount)
  const total = shownDays.reduce(
    (sum, day) =>
      sum +
      families.reduce(
        (acc, key) =>
          acc + (metric === 'spend' ? day.quota[key] : day.tokens[key]),
        0
      ),
    0
  )
  const requests = shownDays.reduce((sum, day) => sum + day.requests, 0)
  // The logs page shows only today unless given a start (ms).
  const logsSince = shownDays[0] ? shownDays[0].start * 1000 : undefined
  const format = (value: number) =>
    metric === 'spend'
      ? money(value, locale)
      : formatCompactNumber(value, locale)
  const sub =
    metric === 'spend' && range === '30'
      ? t('Last {{days}} days · {{amount}} a day on average', {
          days: dayCount,
          amount: money(total / dayCount, locale),
        })
      : t('Last {{days}} days · {{count}} requests', {
          days: dayCount,
          count: formatNumber(requests, locale),
        })
  const caption =
    metric === 'spend'
      ? t('Daily spend in the last {{days}} days, by model family', {
          days: dayCount,
        })
      : t('Daily tokens in the last {{days}} days, by model family', {
          days: dayCount,
        })

  return (
    <section className='bo-card bo-use' aria-labelledby='bo-use-title'>
      <div className='bo-card-h'>
        <h2 id='bo-use-title'>{t('Usage')}</h2>
        <InfoTip
          text={t(
            'Counted per calendar day. Today is still running, so its bar is lighter.'
          )}
        />
        <div className='bo-use-ctl'>
          <Segmented
            label={t('Metric')}
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'spend', label: t('Spend') },
              { value: 'tokens', label: 'Tokens' },
            ]}
          />
          <Segmented
            label={t('Time range')}
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: t('{{count}} days', { count: 7 }) },
              { value: '30', label: t('{{count}} days', { count: 30 }) },
            ]}
          />
        </div>
      </div>
      <div className='bo-use-b'>
        <div>
          <div className='bo-use-v'>{format(total)}</div>
          <div className='bo-use-s'>{sub}</div>
          <Link
            to='/usage-logs/$section'
            params={{ section: 'common' }}
            search={{ startTime: logsSince }}
            className='bo-link bo-use-l'
          >
            {t('View logs')}
          </Link>
          <ul className='bo-legend' aria-hidden='true'>
            {[...families].reverse().map((key) => (
              <li key={key}>
                <i className={`bo-sw bo-fam-${key}`} />
                {t(FAMILY_LABELS[key])}
              </li>
            ))}
          </ul>
        </div>
        <UsageChart
          days={days}
          families={families}
          barWidth={range === '7' ? 28 : 10}
          emptyMax={metric === 'spend' ? quotaPerUnit() : 1000}
          format={format}
          axisFormat={(value) =>
            metric === 'spend'
              ? axisMoney(value, locale)
              : formatCompactNumber(value, locale)
          }
        />
      </div>
      <table className='sr-only'>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope='col'>{t('Date')}</th>
            <th scope='col'>{t('Total')}</th>
            {families.map((key) => (
              <th key={key} scope='col'>
                {t(FAMILY_LABELS[key])}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.label}>
              <th scope='row'>{day.label}</th>
              <td>
                {format(
                  families.reduce((sum, key) => sum + (day.values[key] ?? 0), 0)
                )}
              </td>
              {families.map((key) => (
                <td key={key}>{format(day.values[key] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
