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
import type { TFunction } from 'i18next'
import { Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getGreeting } from '@/features/bear-chat/constants'
import { toIntlLocale } from '@/i18n/languages'

import { money } from '../lib/money'
import { daysPhrase } from '../lib/phrases'
import type { UsageSummary } from '../lib/usage'

/** Changes smaller than this read as "about the same" */
const FLAT_CHANGE = 0.05

/**
 * The space before the next sentence. The punctuation is in the
 * translations, so a sentence that ends in a full-width stop (Chinese,
 * Japanese) needs none.
 */
function gapAfter(sentence: string): string {
  return /[。！？]$/.test(sentence) ? '' : ' '
}

/** The 7-day change as one sentence, or null without two weeks to compare */
function changeSentence(
  t: TFunction,
  change: number | null,
  percent: Intl.NumberFormat
): string | null {
  if (change === null) return null
  if (Math.abs(change) < FLAT_CHANGE) {
    return t(
      'You spent about the same in the last 7 days as in the 7 days before.'
    )
  }
  if (change > 0) {
    return t(
      'You spent {{percent}} more in the last 7 days than in the 7 days before.',
      { percent: percent.format(change) }
    )
  }
  return t(
    'You spent {{percent}} less in the last 7 days than in the 7 days before.',
    { percent: percent.format(-change) }
  )
}

/** One or two sentences under the greeting: what changed, not the numbers. */
function Lead(props: {
  kind: 'new' | 'low' | 'active'
  credit: number
  balance: number
  runwayDays: number | null
  summary: UsageSummary | null
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })

  if (props.kind === 'new') {
    return props.credit > 0 ? (
      <>
        {t('Your {{amount}} free credit is here.', {
          amount: money(props.credit, locale),
        })}
      </>
    ) : null
  }
  if (props.kind === 'low') {
    if (props.balance <= 0) {
      return (
        <>{t('Your balance is used up. Top up to keep making requests.')}</>
      )
    }
    return (
      <Trans
        i18nKey='Balance {{amount}}. At your 7-day pace, it runs out in <hot>{{when}}</hot>.'
        values={{
          amount: money(props.balance, locale),
          when: daysPhrase(t, props.runwayDays ?? 0),
        }}
        components={{ hot: <span className='bo-hot' /> }}
      />
    )
  }

  const summary = props.summary
  if (!summary) return null
  const change = changeSentence(t, summary.change, percent)
  const top = summary.topModel ? (
    <Trans
      i18nKey={
        summary.topModel.share >= 0.5
          ? 'Most of it went to <m>{{model}}</m>.'
          : 'You used <m>{{model}}</m> the most.'
      }
      values={{ model: summary.topModel.name }}
      components={{ m: <span className='bo-nw' /> }}
    />
  ) : null
  if (!change && !top) return <>{t('No spend in the last 7 days')}</>
  return (
    <>
      {change}
      {change && top && gapAfter(change)}
      {top}
    </>
  )
}

/**
 * Console page header: 「概览」, the greeting and what changed, and the two
 * things people come here for — connection details and topping up.
 */
export function OverviewHeader(props: {
  name: string
  kind: 'new' | 'low' | 'active'
  credit: number
  balance: number
  runwayDays: number | null
  summary: UsageSummary | null
  /** The 接入信息 popover trigger */
  access: ReactNode
}) {
  const { t } = useTranslation()
  const greeting = getGreeting(t)
  const hello = props.name
    ? t('{{greeting}}, {{name}}.', { greeting, name: props.name })
    : t('{{greeting}}.', { greeting })
  return (
    <header className='bo-head'>
      <div className='min-w-0'>
        <h1 className='page-title'>{t('Overview')}</h1>
        <p className='bo-lead'>
          {hello}
          {gapAfter(hello)}
          <Lead
            kind={props.kind}
            credit={props.credit}
            balance={props.balance}
            runwayDays={props.runwayDays}
            summary={props.summary}
          />
        </p>
      </div>
      <div className='bo-acts'>
        {props.access}
        <Button
          className='h-9 px-3'
          render={<Link to='/wallet' search={{ tab: 'topup' }} />}
        >
          <Wallet data-icon='inline-start' />
          {t('Top up')}
        </Button>
      </div>
    </header>
  )
}
