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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CircleAlert, Clock, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { getUserBillingHistory } from '@/features/wallet/api'
import { toIntlLocale } from '@/i18n/languages'
import { requireServerSuccess } from '@/lib/server-error-message'

import { walletKeys } from '../constants'
import { usd } from '../lib/format'
import { quotaToUsd, type Pack } from '../lib/packs'
import { tierFor, type PayRules } from '../lib/rules'

/** How long the banner keeps asking before it stops waiting */
const MAX_POLLS = 20
const POLL_MS = 3000
/** How long after the payment its bonus pack can start */
const BONUS_WINDOW_S = 600
/** Packs hold whole quota units; bonuses are worked out to the cent */
const BONUS_MATCH_USD = 0.006

const cents = (value: number) => Math.round(value * 100) / 100

/**
 * Shown when pay-bridge sends the payer back with ?paid=<order>. It says what
 * arrived, including the bonus once pay-bridge has granted it.
 *
 * pay-bridge grants each bonus as its own pack, bound after New API has
 * credited the order, so the order's bonus is a pack that starts after the
 * order was completed and holds the bonus this order earns (the tier's, or
 * the 新人礼包's when that is larger). An earlier order's pack can start
 * within minutes too, so time alone does not tell them apart.
 *
 * Subscription orders (SUB…) cannot be looked up from here; the banner only
 * says the gift pack arrived once the wallet holds a bought pack.
 */
export function PaidBanner(props: {
  trade: string
  rules: PayRules
  packs: Pack[]
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const queryClient = useQueryClient()
  const isGift = props.trade.startsWith('SUB')
  const queryKey = [...walletKeys.history, 'trade', props.trade]
  const order = useQuery({
    queryKey,
    queryFn: async () => {
      const res = requireServerSuccess(
        await getUserBillingHistory(1, 5, props.trade)
      )
      return (
        res.data?.items?.find((item) => item.trade_no === props.trade) ?? null
      )
    },
    enabled: !isGift,
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' &&
      query.state.dataUpdateCount < MAX_POLLS
        ? POLL_MS
        : false,
  })

  const record = order.data
  // New API also writes 'failed', which TopupStatus does not list.
  const status: string | undefined = record?.status
  const paid = record?.status === 'success'
  const amount = record?.amount ?? 0
  const doneAt = record?.complete_time || record?.create_time || 0
  const money = record?.money ?? 0
  const expected = paid
    ? cents(amount * (tierFor(props.rules.tiers, money)?.rate ?? 0))
    : 0
  // The 新人礼包 price is below every tier but still earns a bonus; an
  // account that already had it gets the tier's bonus, so both are accepted.
  const starter =
    paid &&
    props.rules.first !== null &&
    Math.abs(money - props.rules.first.pay) < 0.005
  const earned = [expected, starter ? cents(props.rules.first?.bonus ?? 0) : 0]
  const bonus = paid
    ? props.packs.find(
        (pack) =>
          (pack.kind === 'bonus' || pack.kind === 'first') &&
          pack.startsAt >= doneAt &&
          pack.startsAt - doneAt < BONUS_WINDOW_S &&
          earned.some(
            (usdBonus) =>
              usdBonus > 0 &&
              Math.abs(quotaToUsd(pack.total) - usdBonus) < BONUS_MATCH_USD
          )
      )
    : undefined
  // Without pay-bridge's rules the gift plan is not known: any bought pack.
  const giftKind = props.rules.giftPlanId === null ? 'plan' : 'gift'
  const giftArrived =
    isGift && props.packs.some((pack) => pack.kind === giftKind)
  const [giftGaveUp, setGiftGaveUp] = useState(false)

  // pay-bridge grants the bonus right after New API credits the order; a
  // bought pack shows up once New API has the subscription order paid.
  const waitBonus = (expected > 0 || starter) && !bonus
  const waitGift = isGift && !giftArrived
  useEffect(() => {
    if (!waitBonus && !waitGift) return
    let polls = 0
    const timer = window.setInterval(() => {
      polls += 1
      void queryClient.invalidateQueries({ queryKey: walletKeys.subscriptions })
      if (polls >= MAX_POLLS) {
        window.clearInterval(timer)
        if (waitGift) setGiftGaveUp(true)
      }
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [waitBonus, waitGift, queryClient])

  // Read so the banner renders on every poll, an unchanged answer included.
  const polls = order.dataUpdatedAt
    ? (queryClient.getQueryState(queryKey)?.dataUpdateCount ?? 0)
    : 0

  let text = null
  let icon = <Check className='bw-paid-ic' aria-hidden='true' />
  let failed = false
  if (isGift && giftArrived) {
    text = t('Payment received. The gift pack is in your wallet.')
  } else if (isGift && giftGaveUp) {
    text = t(
      'The payment is not confirmed yet. Refresh this page in a few minutes.'
    )
    icon = <Clock className='bw-paid-ic' aria-hidden='true' />
  } else if (isGift) {
    text = t('Confirming your payment…')
    icon = (
      <Loader2
        className='bw-paid-ic animate-spin motion-reduce:animate-none'
        aria-hidden='true'
      />
    )
  } else if (paid && bonus) {
    text = (
      <Trans
        i18nKey='Payment received: <b>{{amount}}</b> added, plus <g>{{bonus}}</g> bonus'
        values={{
          amount: usd(amount, locale),
          bonus: usd(quotaToUsd(bonus.total), locale),
        }}
        components={{ b: <b />, g: <b className='bw-bonus' /> }}
      />
    )
  } else if (paid) {
    text = (
      <Trans
        i18nKey='Payment received: <b>{{amount}}</b> added'
        values={{ amount: usd(amount, locale) }}
        components={{ b: <b /> }}
      />
    )
  } else if (status === 'failed' || status === 'expired') {
    text =
      status === 'failed'
        ? t('The payment did not go through.')
        : t('This order expired before it was paid.')
    icon = <CircleAlert className='bw-paid-ic' aria-hidden='true' />
    failed = true
  } else if (order.isError && !record) {
    text = t(
      'Could not check this payment. Refresh this page in a few minutes.'
    )
    icon = <CircleAlert className='bw-paid-ic' aria-hidden='true' />
    failed = true
  } else if (
    order.isPending ||
    (record?.status === 'pending' && polls < MAX_POLLS)
  ) {
    text = t('Confirming your payment…')
    icon = (
      <Loader2
        className='bw-paid-ic animate-spin motion-reduce:animate-none'
        aria-hidden='true'
      />
    )
  } else if (record?.status === 'pending') {
    // Polling has stopped; EPay can still call back later.
    text = t(
      'The payment is not confirmed yet. Refresh this page in a few minutes.'
    )
    icon = <Clock className='bw-paid-ic' aria-hidden='true' />
  }
  if (!text) return null

  return (
    <div className='bw-paid' data-failed={failed || undefined} role='status'>
      {icon}
      <p>{text}</p>
      <button
        type='button'
        className='bw-x'
        aria-label={t('Close')}
        onClick={props.onClose}
      >
        <X aria-hidden='true' />
      </button>
    </div>
  )
}
