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
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usd } from '@/features/bear-wallet/lib/format'
import { percent, yuan } from '@/features/bear-wallet/lib/rules'
import { toIntlLocale } from '@/i18n/languages'
import { cn } from '@/lib/utils'

import {
  sharePercent,
  type InviteOffer,
  type Offer,
  type RateOffer,
  type StarterOffer,
  type TiersOffer,
} from '../lib/offers'

// The wallet's deal colours, set on .act-page in activity.css
const GIFT = 'text-(--act-gift)'
const GOOD = 'text-(--act-good)'

/** Where a guest or a signed-in user can act on the 新人礼包 */
export type StarterState = 'guest' | 'open' | 'claimed'

export interface ActivityContentProps {
  offers: Offer[]
  loading: boolean
  starter: StarterState
}

/**
 * 活动: every running offer on one page, after OpenModel's campaigns page,
 * with each offer's numbers written out instead of behind a details page.
 */
export function ActivityContent(props: ActivityContentProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const rate = props.offers.find(
    (offer): offer is RateOffer => offer.kind === 'rate'
  )
  const lead = rate
    ? t(
        'Charged at official USD prices, ¥1 buys {{credit}} of credit. New accounts, top-ups and invites get extra credit, and the numbers below are the ones you get at checkout.',
        { credit: usd(rate.credit, locale) }
      )
    : t(
        'New accounts, top-ups and invites get extra credit, and the numbers below are the ones you get at checkout.'
      )

  return (
    <div className='act-page mx-auto w-full max-w-5xl px-4 pt-28 pb-20 sm:px-6 sm:pt-36 sm:pb-28'>
      <header className='max-w-3xl'>
        <h1 className='font-serif text-[clamp(2.375rem,6vw,3.75rem)] leading-[1.15] font-normal tracking-[0.01em]'>
          <Trans
            i18nKey='<line>All our offers,</line> <muted>on one page.</muted>'
            components={{
              line: <span className='block' />,
              muted: <span className='text-muted-foreground block' />,
            }}
          />
        </h1>
        {!props.loading && (
          <p className='text-muted-foreground mt-6 max-w-xl text-[15px] leading-relaxed sm:text-base'>
            {lead}
          </p>
        )}
      </header>

      <section
        aria-labelledby='activity-ongoing'
        className='mt-14 grid gap-8 border-t pt-10 sm:mt-20 md:grid-cols-[168px_minmax(0,1fr)] md:gap-10 md:pt-12'
      >
        <h2
          id='activity-ongoing'
          className='font-serif text-lg font-normal md:pt-1'
        >
          {t('Ongoing')}
          {!props.loading && (
            <span className='text-muted-foreground ml-2 align-top font-sans text-xs tabular-nums'>
              {props.offers.length}
            </span>
          )}
        </h2>

        <OfferList
          offers={props.offers}
          loading={props.loading}
          locale={locale}
          starter={props.starter}
        />
      </section>

      {!props.loading &&
        props.offers.some(
          (o) => o.kind === 'starter' || o.kind === 'tiers'
        ) && (
          <p className='text-muted-foreground mt-12 text-xs leading-relaxed md:ml-[208px]'>
            {t(
              'Bonus credit shows in your wallet as credit with an expiry date and is used before your balance.'
            )}
          </p>
        )}
    </div>
  )
}

function OfferList(props: {
  offers: Offer[]
  loading: boolean
  locale: string | undefined
  starter: StarterState
}) {
  const { t } = useTranslation()
  if (props.loading) {
    return (
      <div className='flex flex-col gap-10' aria-hidden='true'>
        {[0, 1, 2].map((i) => (
          <div key={i} className='flex flex-col gap-3'>
            <Skeleton className='h-3 w-24' />
            <Skeleton className='h-7 w-40' />
            <Skeleton className='h-4 w-full max-w-md' />
          </div>
        ))}
      </div>
    )
  }
  if (props.offers.length === 0) {
    return (
      <p className='text-muted-foreground text-sm md:pt-1.5'>
        {t('No offers right now.')}
      </p>
    )
  }
  return (
    <ol className='flex flex-col'>
      {props.offers.map((offer) => (
        <li
          key={offer.kind}
          className='border-t py-9 first:border-t-0 first:pt-0 last:pb-0'
        >
          <OfferRow
            offer={offer}
            locale={props.locale}
            starter={props.starter}
          />
        </li>
      ))}
    </ol>
  )
}

function OfferRow(props: {
  offer: Offer
  locale: string | undefined
  starter: StarterState
}) {
  switch (props.offer.kind) {
    case 'rate':
      return <RateRow offer={props.offer} locale={props.locale} />
    case 'starter':
      return (
        <StarterRow
          offer={props.offer}
          locale={props.locale}
          state={props.starter}
        />
      )
    case 'tiers':
      return <TiersRow offer={props.offer} locale={props.locale} />
    case 'invite':
      return <InviteRow offer={props.offer} locale={props.locale} />
  }
}

/** Shared frame: tags, title and text; the figure beside; the action below */
function Row(props: {
  tags: string[]
  title: string
  text: string
  figure: ReactNode
  action: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <article className='grid gap-x-10 gap-y-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:grid-rows-[auto_1fr]'>
      <div className='min-w-0 sm:col-start-1 sm:row-start-1'>
        <p className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'>
          <span
            aria-hidden='true'
            className='size-1.5 rounded-full bg-(--act-good)'
          />
          {[t('No end date'), ...props.tags].join(' · ')}
        </p>
        <h3 className='mt-2.5 font-serif text-[1.625rem] leading-snug font-normal sm:text-[1.75rem]'>
          {props.title}
        </h3>
        <p className='text-muted-foreground mt-2 max-w-md text-sm leading-relaxed'>
          {props.text}
        </p>
      </div>
      <div className='sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:text-right'>
        {props.figure}
      </div>
      <div className='sm:col-start-1 sm:row-start-2'>{props.action}</div>
    </article>
  )
}

function Figure(props: { value: string; note: string; className?: string }) {
  return (
    <div>
      <p
        className={cn(
          'font-serif text-[2.5rem] leading-none tabular-nums sm:text-5xl',
          props.className
        )}
      >
        {props.value}
      </p>
      <p className='text-muted-foreground mt-2.5 text-sm'>{props.note}</p>
    </div>
  )
}

/**
 * "1 day", "30 days", "30 天": the locale picks the plural; where it puts no
 * space between the number and the unit (zh, ja) we add the one the site uses
 */
function dayCount(days: number, locale: string | undefined): string {
  const parts = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'day',
    unitDisplay: 'long',
  }).formatToParts(days)
  return parts
    .map((part, i) =>
      part.type === 'unit' && parts[i - 1]?.type === 'integer'
        ? ` ${part.value}`
        : part.value
    )
    .join('')
}

/** Buttons are real links; the arrow says they lead to another page */
function actionClass(primary = false) {
  return cn(
    buttonVariants({ variant: primary ? 'default' : 'outline' }),
    'gap-1.5'
  )
}

function Arrow() {
  return <ArrowRight aria-hidden='true' className='size-4' />
}

function RateRow(props: { offer: RateOffer; locale: string | undefined }) {
  const { t } = useTranslation()
  const credit = usd(props.offer.credit, props.locale)
  return (
    <Row
      tags={[]}
      title={t('Top-up rate')}
      text={t(
        'Every model is charged at its official USD price, so $1 here buys as much usage as $1 at the official API.'
      )}
      figure={
        <Figure
          value={`¥1 = ${credit}`}
          note={t('About {{share}} of the official price', {
            share: sharePercent(props.offer.share),
          })}
        />
      }
      action={
        <Link to='/pricing' className={actionClass()}>
          {t('See model prices')}
          <Arrow />
        </Link>
      }
    />
  )
}

function StarterRow(props: {
  offer: StarterOffer
  locale: string | undefined
  state: StarterState
}) {
  const { t } = useTranslation()
  const credit = usd(props.offer.credit, props.locale)
  const bonus = usd(props.offer.bonus, props.locale)
  let action: ReactNode
  if (props.state === 'claimed') {
    action = (
      <p className='text-muted-foreground text-sm'>
        {t('You have claimed it.')}
      </p>
    )
  } else if (props.state === 'open') {
    action = (
      <Link
        to='/wallet'
        search={{ tab: 'topup' }}
        className={actionClass(true)}
      >
        {t('Claim it')}
        <Arrow />
      </Link>
    )
  } else {
    action = (
      <Link to='/sign-up' className={actionClass(true)}>
        {t('Sign up to claim')}
        <Arrow />
      </Link>
    )
  }
  return (
    <Row
      tags={[
        t('Once per account'),
        t('Bonus valid for {{duration}}', {
          duration: dayCount(props.offer.days, props.locale),
        }),
      ]}
      title={t('Starter pack')}
      text={t(
        'Pay {{pay}} once and get {{credit}} of credit plus {{bonus}} free.',
        {
          pay: yuan(props.offer.pay, props.locale),
          credit,
          bonus,
        }
      )}
      figure={
        <Figure
          value={`${yuan(props.offer.pay, props.locale)} → ${usd(props.offer.credit + props.offer.bonus, props.locale)}`}
          note={t('{{credit}} credit + {{bonus}} free', { credit, bonus })}
          className={GIFT}
        />
      }
      action={action}
    />
  )
}

function TiersRow(props: { offer: TiersOffer; locale: string | undefined }) {
  const { t } = useTranslation()
  const rates = props.offer.rows.map((row) => row.rate)
  const top = Math.max(...rates)
  const tags =
    props.offer.days > 0
      ? [
          t('Bonus valid for {{duration}}', {
            duration: dayCount(props.offer.days, props.locale),
          }),
        ]
      : []
  return (
    <Row
      tags={tags}
      title={t('Top-up bonus')}
      text={t(
        'One payment from {{min}} gets {{low}}–{{max}}% extra credit: the bigger the payment, the bigger the bonus.',
        {
          min: yuan(props.offer.rows[0].pay, props.locale),
          low: percent(Math.min(...rates)),
          max: percent(top),
        }
      )}
      figure={
        <table className='w-full text-sm tabular-nums sm:w-auto'>
          <caption className='sr-only'>{t('Top-up bonus')}</caption>
          <thead>
            <tr className='text-muted-foreground text-xs'>
              <th scope='col' className='pb-2 text-left font-normal'>
                {t('One payment')}
              </th>
              <th scope='col' className='pb-2 pl-6 text-right font-normal'>
                {t('Credit you get')}
              </th>
              <th scope='col' className='pb-2 pl-6 text-right font-normal'>
                {t('Bonus credit')}
              </th>
            </tr>
          </thead>
          <tbody>
            {props.offer.rows.map((row) => (
              <tr key={row.pay} className='border-t'>
                <th scope='row' className='py-1.5 text-left font-medium'>
                  {yuan(row.pay, props.locale)}
                </th>
                <td className='py-1.5 pl-6 text-right'>
                  {usd(row.credit, props.locale)}
                </td>
                <td
                  className={cn(
                    'py-1.5 pl-6 text-right',
                    GOOD,
                    row.rate === top && 'font-semibold'
                  )}
                >
                  +{usd(row.bonus, props.locale)}
                  <span className='text-muted-foreground ml-1.5 inline-block w-8 text-xs font-normal'>
                    {percent(row.rate)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      action={
        <Link to='/wallet' search={{ tab: 'topup' }} className={actionClass()}>
          {t('Go to top up')}
          <Arrow />
        </Link>
      }
    />
  )
}

function InviteRow(props: { offer: InviteOffer; locale: string | undefined }) {
  const { t } = useTranslation()
  const you = usd(props.offer.inviter, props.locale)
  const friend = usd(props.offer.invitee, props.locale)
  let text: string
  if (props.offer.inviter > 0 && props.offer.invitee > 0) {
    text = t(
      'When a friend signs up with your link, you get {{inviter}} and they get {{invitee}} extra.',
      { inviter: you, invitee: friend }
    )
  } else if (props.offer.inviter > 0) {
    text = t('When a friend signs up with your link, you get {{inviter}}.', {
      inviter: you,
    })
  } else {
    text = t('Friends who sign up with your link get {{invitee}} extra.', {
      invitee: friend,
    })
  }
  return (
    <Row
      tags={[]}
      title={t('Invite rewards')}
      text={text}
      figure={
        <div className='flex gap-8 sm:justify-end'>
          {props.offer.inviter > 0 && (
            <Figure value={you} note={t('You get')} />
          )}
          {props.offer.invitee > 0 && (
            <Figure value={friend} note={t('Your friend gets')} />
          )}
        </div>
      }
      action={
        <Link to='/invite' className={actionClass()}>
          {t('Invite friends')}
          <Arrow />
        </Link>
      }
    />
  )
}
