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
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { KeyRow } from '../lib/keys'
import { money } from '../lib/money'

/** Bars turn amber from this share of the limit */
const WARN_SHARE = 0.75

export function KeyLimits(props: {
  rows: KeyRow[]
  loading: boolean
  updatedAt: number
  refreshing: boolean
  onRefresh: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })
  const lastUsed = (row: KeyRow) =>
    row.key.accessed_time
      ? t('Used {{time}}', {
          time: formatTimestampRelative(
            row.key.accessed_time,
            'seconds',
            locale
          ),
        })
      : t('Never used')
  const updated = props.updatedAt
    ? new Date(props.updatedAt).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <section aria-labelledby='bo-keys-title'>
      <div className='bo-sec-h'>
        <h2 id='bo-keys-title'>{t('API key limits')}</h2>
        <p>
          {t("Give each key a limit so one app can't use up your balance.")}
        </p>
        <Link to='/keys'>{t('Manage keys')}</Link>
      </div>
      <div className='bo-card bo-meters'>
        {props.loading && !props.rows.length && (
          <div className='bo-m'>
            <span className='bo-skel h-9 w-40' />
            <span className='bo-skel h-2' />
            <span className='bo-skel ml-auto h-8 w-16' />
          </div>
        )}
        {!props.loading && !props.rows.length && (
          <p className='bo-m-empty'>
            {t('No API keys yet.')}{' '}
            <Link to='/keys' className='bo-link'>
              {t('Create API Key')}
            </Link>
          </p>
        )}
        {props.rows.map((row) => {
          const limit = row.key.remain_quota + row.key.used_quota
          if (row.usedShare === null) {
            return (
              <div key={row.key.id} className='bo-m'>
                <div className='bo-m-n'>
                  <span>{row.key.name}</span>
                  <small>{t('No limit')}</small>
                  <small>{lastUsed(row)}</small>
                </div>
                <div className='bo-spent'>
                  {t('{{amount}} in the last 30 days', {
                    amount: money(row.recent, locale),
                  })}
                </div>
                <div className='bo-m-p'>
                  <Link to='/keys'>{t('Set a limit')}</Link>
                </div>
              </div>
            )
          }
          const share = row.usedShare
          return (
            <div key={row.key.id} className='bo-m'>
              <div className='bo-m-n'>
                <span>{row.key.name}</span>
                <small>
                  {t('Limit {{amount}}', { amount: money(limit, locale) })}
                </small>
                <small>{lastUsed(row)}</small>
              </div>
              <div
                className={cn('bo-bar', share >= WARN_SHARE && 'bo-warn')}
                role='meter'
                aria-label={t('{{name}} used', { name: row.key.name })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(share * 100)}
              >
                <i style={{ width: `${share * 100}%` }} />
              </div>
              <div className='bo-m-p'>
                <b>
                  {row.key.status === 4
                    ? t('Used up')
                    : t('{{percent}} used', { percent: percent.format(share) })}
                </b>
                <small>
                  {t('{{amount}} left', {
                    amount: money(row.key.remain_quota, locale),
                  })}
                </small>
              </div>
            </div>
          )
        })}
      </div>
      <div className='bo-upd'>
        {updated && <span>{t('Updated {{time}}', { time: updated })}</span>}
        <Button
          variant='ghost'
          size='icon-xs'
          onClick={props.onRefresh}
          disabled={props.refreshing}
          aria-label={t('Refresh')}
          title={t('Refresh')}
        >
          <RefreshCw
            aria-hidden='true'
            className={cn(props.refreshing && 'animate-spin')}
          />
        </Button>
      </div>
    </section>
  )
}
