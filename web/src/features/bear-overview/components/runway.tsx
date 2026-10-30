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
import { Trans, useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'

import {
  RUNWAY_MAX_DAYS,
  calendarDaysFrom,
  dayPart,
  type DayPart,
} from '../lib/usage'

const TODAY_PARTS: Record<DayPart, string> = {
  night: 'early this morning',
  morning: 'this morning',
  afternoon: 'this afternoon',
  evening: 'this evening',
}
const TOMORROW_PARTS: Record<DayPart, string> = {
  night: 'early tomorrow morning',
  morning: 'tomorrow morning',
  afternoon: 'tomorrow afternoon',
  evening: 'tomorrow evening',
}

/**
 * The wallet card's runway line. Within two days it names the part of the
 * day ("tomorrow morning"); after that, the date. A pace that lasts past
 * RUNWAY_MAX_DAYS is shown as "over N days".
 */
export function RunwayLine(props: {
  balance: number
  perDay: number
  runOut: Date | null
  now: Date
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  if (props.balance <= 0) return <>{t('Balance used up')}</>
  if (props.perDay <= 0) return <>{t('No spend in the last 7 days')}</>
  if (!props.runOut) {
    return (
      <>
        {t('At your 7-day pace, it lasts over {{count}} days', {
          count: RUNWAY_MAX_DAYS,
        })}
      </>
    )
  }
  const days = calendarDaysFrom(props.now, props.runOut)
  if (days <= 1) {
    const part = dayPart(props.runOut)
    return (
      <Trans
        i18nKey='At your 7-day pace, it runs out <nw>{{when}}</nw>'
        values={{
          when: t(days === 0 ? TODAY_PARTS[part] : TOMORROW_PARTS[part]),
        }}
        components={{ nw: <span className='bo-nw' /> }}
      />
    )
  }
  return (
    <Trans
      i18nKey='At your 7-day pace, it runs out <nw>on {{date}}</nw>'
      values={{
        date: props.runOut.toLocaleDateString(locale, {
          month: 'long',
          day: 'numeric',
        }),
      }}
      components={{ nw: <span className='bo-nw' /> }}
    />
  )
}
