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
import { useTranslation } from 'react-i18next'

import { money } from '@/features/bear-overview/lib/money'
import { toIntlLocale } from '@/i18n/languages'

import { monthDay } from '../lib/format'
import type { Pack } from '../lib/packs'

/**
 * Every pack that still holds credit, with what is left and when it lapses,
 * so nothing expires unseen. New API spends the soonest-ending one first.
 */
export function PacksList(props: { packs: Pack[]; nowSeconds: number }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  if (!props.packs.length) return null

  const name = (pack: Pack) => {
    if (pack.kind === 'bonus') return t('Top-up bonus')
    if (pack.kind === 'first') return t('Starter pack')
    if (pack.kind === 'gift') return t('Gift pack')
    return t('Plan credit')
  }
  const daysLeft = (pack: Pack) => {
    const days = Math.floor((pack.endsAt - props.nowSeconds) / 86400)
    return days < 1
      ? t('Expires within a day')
      : t('{{days}} days left', { days })
  }

  return (
    <section aria-labelledby='bw-packs-h' className='border-b'>
      <h3
        id='bw-packs-h'
        className='text-muted-foreground px-4 pt-3 pb-1 text-xs sm:px-5'
      >
        {t('Credit with an expiry date')}
      </h3>
      <ul>
        {props.packs.map((pack) => (
          <li
            key={pack.id}
            className='flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-sm sm:px-5'
          >
            <span className='font-medium'>{name(pack)}</span>
            <span className='text-muted-foreground tabular-nums'>
              {t('{{left}} left of {{total}}', {
                left: money(pack.left, locale),
                total: money(pack.total, locale),
              })}
            </span>
            <span className='ms-auto tabular-nums'>
              {t('Expires on {{date}}', {
                date: monthDay(pack.endsAt, locale),
              })}
              <span className='text-muted-foreground'>
                {' · '}
                {daysLeft(pack)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
