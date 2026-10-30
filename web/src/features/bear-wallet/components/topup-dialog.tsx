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
import { Radio } from '@base-ui/react/radio'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup } from '@/components/ui/radio-group'
import { quotaPerUnit } from '@/features/bear-overview/lib/money'
import { paySubscriptionEpay } from '@/features/subscriptions/api'
import { isApiSuccess } from '@/features/wallet/api'
import { usePayment } from '@/features/wallet/hooks/use-payment'
import { getPaymentIcon, submitPaymentForm } from '@/features/wallet/lib'
import { useDebounce } from '@/hooks/use-debounce'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { CUSTOM_MAX, CUSTOM_MIN, DEFAULT_PAY } from '../constants'
import { refusalText, usePayMoney } from '../hooks/use-pay-money'
import { usd } from '../lib/format'
import { starterOffer, type Starter, type TopupOffer } from '../lib/offer'
import { planDays, quotaToUsd } from '../lib/packs'
import {
  amountChips,
  effectivePrice,
  percent,
  quote,
  topupRequestAmount,
  yuan,
} from '../lib/rules'
import { GiftIcon } from './gift-icon'

type Choice =
  | { kind: 'chip'; pay: number }
  | { kind: 'starter' }
  | { kind: 'gift' }
  | { kind: 'custom' }

/** An amount radio's value: a button's yuan, or one of the two packs */
type ChoiceValue = number | 'starter' | 'gift'

export interface TopupDialogProps extends TopupOffer {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Rules, plans and payment methods have loaded */
  ready: boolean
  /** Dollars picked elsewhere (the overview's quick amounts) */
  initialAmount?: number
  /** The cashier opened, so the page should refresh when the user returns */
  onOpened: () => void
}

function defaultChip(chips: number[]): Choice {
  const pay = chips.includes(DEFAULT_PAY)
    ? DEFAULT_PAY
    : chips[Math.min(1, chips.length - 1)]
  return { kind: 'chip', pay }
}

function firstChoice(
  props: TopupDialogProps,
  chips: number[],
  starter: Starter | null
): { choice: Choice; custom: string } {
  const wanted = props.initialAmount ?? 0
  if (wanted > 0) {
    const pay = Math.round(wanted * props.price * 100) / 100
    if (chips.includes(pay)) {
      return { choice: { kind: 'chip', pay }, custom: '' }
    }
    if (Number.isInteger(pay) && pay >= CUSTOM_MIN && pay <= CUSTOM_MAX) {
      return { choice: { kind: 'custom' }, custom: String(pay) }
    }
  }
  if (starter) return { choice: { kind: 'starter' }, custom: '' }
  if (props.isNew && props.gift) return { choice: { kind: 'gift' }, custom: '' }
  return { choice: defaultChip(chips), custom: '' }
}

function choiceValue(choice: Choice): ChoiceValue | null {
  if (choice.kind === 'chip') return choice.pay
  if (choice.kind === 'custom') return null
  return choice.kind
}

/** How long typing in the amount field waits before New API is asked */
const QUOTE_DEBOUNCE_MS = 300

/** Whole yuan in range, or null */
function parseCustom(value: string): number | null {
  if (!/^\d{1,6}$/.test(value)) return null
  const n = Number(value)
  return n >= CUSTOM_MIN && n <= CUSTOM_MAX ? n : null
}

/**
 * 充值, after OpenModel's top-up dialog: amount buttons, one field for any
 * other amount, then the payment method, with the pay button in the footer.
 * Ours adds the 新人礼包, each amount's bonus and one line saying what
 * arrives.
 *
 * The amount and method buttons are Base UI radios (arrow keys, one Tab stop
 * per group) inside the project's RadioGroup: ui/radio-group's item always
 * draws a 16px dot and drops its children, and ui/toggle-group gives toggle
 * buttons (aria-pressed), not radios.
 */
export function TopupDialog(props: TopupDialogProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const displayType = useSystemConfigStore(
    (state) => state.config.currency.quotaDisplayType
  )
  // New API's top-up endpoints count in tokens when the site shows tokens.
  const toRequest = (dollars: number) =>
    topupRequestAmount(dollars, {
      quotaDisplayType: displayType,
      quotaPerUnit: quotaPerUnit(),
    })
  // Credit in the site's quota unit, told apart from the yuan price.
  const creditText = (dollars: number) => {
    if (displayType === 'TOKENS') {
      return t('{{value}} tokens', {
        value: formatNumber(Math.round(dollars * quotaPerUnit()), locale),
      })
    }
    if (displayType === 'USD') return usd(dollars, locale)
    return t('{{amount}} of credit', { amount: usd(dollars, locale) })
  }
  const tiers = props.rules.tiers
  const topRate = Math.max(0, ...tiers.map((tier) => tier.rate))
  const chips = amountChips(tiers)
  const chipAmounts = chips.map(
    (chip) => quote(chip, props.price, tiers).amount
  )
  const asking = props.open && props.ready && props.methods.length > 0
  // The 新人礼包 needs New API to charge exactly its price; it is offered
  // only once New API says so.
  const offered = starterOffer(props)
  const starterRequest = offered ? toRequest(offered.quote.amount) : 0
  const starterPrice = usePayMoney([starterRequest], asking)(starterRequest)
  const starter =
    offered &&
    starterPrice.money !== null &&
    Math.abs(starterPrice.money - offered.rule.pay) < 0.005
      ? offered
      : null
  // What the user picked, or null for the offer's default. The default
  // follows the data until it has loaded; all of it is forgotten once the
  // dialog has closed, so it opens on the default again.
  const [picked, setPicked] = useState<Choice | null>(null)
  const [customInput, setCustomInput] = useState<string | null>(null)
  const [methodInput, setMethodInput] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const [opened, setOpened] = useState(false)
  const { processPayment } = usePayment()

  const start = firstChoice(props, chips, starter)
  let choice = picked ?? start.choice
  // The gift goes away once the user has had it (the page refreshes on return).
  if (choice.kind === 'starter' && !starter) choice = defaultChip(chips)
  const custom = customInput ?? start.custom
  const method = methodInput ?? props.methods[0]?.type ?? ''

  const gift = props.gift
  const giftDays = gift ? planDays(gift) : null
  let pay = 0
  if (choice.kind === 'chip') pay = choice.pay
  else if (choice.kind === 'starter' && starter) pay = starter.rule.pay
  else if (choice.kind === 'custom') pay = parseCustom(custom) ?? 0
  const first = props.canGetStarter ? props.rules.first : null
  const amount = quote(pay, props.price, tiers, first).amount
  const belowMin =
    choice.kind !== 'gift' && amount > 0 && amount < props.minTopup
  const request = choice.kind !== 'gift' && !belowMin ? toRequest(amount) : 0
  // Buttons are asked for at once (and ahead of time); typing waits a moment.
  const typed = useDebounce(request, QUOTE_DEBOUNCE_MS)
  const asked = choice.kind === 'custom' ? typed : request
  const chipRequests = chipAmounts.map((dollars) =>
    dollars >= props.minTopup ? toRequest(dollars) : 0
  )
  const priceOf = usePayMoney([...chipRequests, asked], asking)
  const chipMoney = chipRequests.map((req) => priceOf(req).money)
  // The buttons and the starter pack show New API's prices: until its first
  // answers are in, the form waits, so nothing jumps or shows a wrong sum.
  const pricesIn =
    !starterPrice.firstPending &&
    !chipRequests.some((req) => req > 0 && priceOf(req).firstPending)
  const unitPrice = effectivePrice(
    props.price,
    chipAmounts.map((dollars, index) => ({
      amount: dollars,
      money: chipMoney[index],
    }))
  )
  const rate =
    unitPrice === null
      ? null
      : `${yuan(1, locale)} = ${creditText(1 / unitPrice)}`
  // The tier follows what New API will store as the order's money.
  const current = priceOf(request)
  const q = quote(pay, props.price, tiers, first, current.money)
  const giftPay = gift?.price_amount ?? 0
  let charge = 0
  let quoting = false
  if (choice.kind === 'gift') charge = giftPay
  else if (request > 0) {
    if (asked !== request || current.pending) quoting = true
    else charge = current.money ?? 0
  }
  // Only for the amount on screen, once New API has had its say
  const shownPrice = !quoting && request > 0 ? current : null
  const canPay =
    Boolean(method) &&
    !opening &&
    !belowMin &&
    charge > 0 &&
    (choice.kind !== 'gift' || Boolean(gift))

  const onOpenChange = (open: boolean) => {
    // Keep what is on screen while the dialog fades out; the page drops
    // ?amount= at once, which would move the default.
    if (!open) {
      setPicked(choice)
      setCustomInput(custom)
    }
    props.onOpenChange(open)
  }
  const forget = (open: boolean) => {
    if (open) return
    setPicked(null)
    setCustomInput(null)
    setMethodInput(null)
    setOpened(false)
  }

  let result = null
  if (choice.kind === 'gift' && gift) {
    const amount = usd(quotaToUsd(gift.total_amount), locale)
    result = giftDays ? (
      <Trans
        i18nKey='You get <b>{{amount}}</b>, valid for {{days}} days'
        values={{ amount, days: giftDays }}
        components={{ b: <b /> }}
      />
    ) : (
      <Trans
        i18nKey='You get <b>{{amount}}</b>'
        values={{ amount }}
        components={{ b: <b /> }}
      />
    )
  } else if (choice.kind === 'custom' && !parseCustom(custom)) {
    result = (
      <span className='bw-dim'>
        {t('Enter a whole number from {{min}} to {{max}}', {
          min: CUSTOM_MIN,
          max: CUSTOM_MAX,
        })}
      </span>
    )
  } else if (belowMin) {
    result = (
      <span className='bw-dim'>
        {t('The minimum top-up is {{amount}}', {
          amount: usd(props.minTopup, locale),
        })}
      </span>
    )
  } else if (shownPrice?.refusal) {
    result = (
      <span className='bw-dim'>
        {refusalText(shownPrice.refusal) ?? t('Payment request failed')}
      </span>
    )
  } else if (shownPrice?.failed) {
    result = (
      <span className='bw-dim inline-flex items-center gap-1.5'>
        {t('Could not get the amount to pay.')}
        <Button
          variant='link'
          size='xs'
          className='h-auto p-0'
          onClick={shownPrice.retry}
        >
          {t('Retry')}
        </Button>
      </span>
    )
  } else if (q.source === 'first' && first) {
    result = (
      <Trans
        i18nKey='You get <b>{{amount}}</b> + <g>{{bonus}}</g> bonus, valid for {{days}} days'
        values={{
          amount: usd(q.amount, locale),
          bonus: usd(q.bonus, locale),
          days: first.days,
        }}
        components={{ b: <b />, g: <b className='bw-bonus' /> }}
      />
    )
  } else if (q.bonus > 0) {
    result = (
      <Trans
        i18nKey='You get <b>{{amount}}</b> + <g>{{bonus}}</g> bonus'
        values={{ amount: usd(q.amount, locale), bonus: usd(q.bonus, locale) }}
        components={{ b: <b />, g: <b className='bw-bonus' /> }}
      />
    )
  } else if (q.amount > 0) {
    result = (
      <Trans
        i18nKey='You get <b>{{amount}}</b>'
        values={{ amount: usd(q.amount, locale) }}
        components={{ b: <b /> }}
      />
    )
  }
  // The tier bonus is a pack of its own; say how it behaves.
  const bonusNote =
    q.bonus > 0 && q.source !== 'first' && props.rules.bonusDays > 0
      ? t(
          'Bonus credit lasts {{days}} days, is used before your balance and cannot be refunded.',
          { days: props.rules.bonusDays }
        )
      : null

  const startPayment = async () => {
    if (!canPay) return
    // What was paid for stays picked when the page refreshes on return.
    setPicked(choice)
    setOpening(true)
    try {
      let ok = false
      if (choice.kind === 'gift' && gift) {
        const res = await paySubscriptionEpay({
          plan_id: gift.id,
          payment_method: method,
        })
        if (isApiSuccess(res) && res.url && res.data) {
          submitPaymentForm(res.url, res.data as Record<string, unknown>)
          ok = true
        } else {
          handleServerError(res, t('Payment request failed'))
        }
      } else {
        ok = await processPayment(request, method)
      }
      if (ok) {
        setOpened(true)
        props.onOpened()
      }
    } catch (error) {
      handleServerError(error, t('Payment request failed'))
    } finally {
      setOpening(false)
    }
  }

  let content
  let footer = null
  if (!props.ready || (props.methods.length > 0 && !pricesIn)) {
    content = <div className='bw-skel' aria-hidden='true' />
  } else if (!props.methods.length) {
    content = (
      <p className='bw-note'>
        {t(
          'Online top-up is not available yet. You can top up with a redemption code.'
        )}
      </p>
    )
  } else {
    content = (
      <div className='bw-form'>
        <RadioGroup
          className='bw-chips'
          aria-label={t('Payment amount')}
          value={choiceValue(choice)}
          onValueChange={(value: ChoiceValue) => {
            setPicked(
              typeof value === 'number'
                ? { kind: 'chip', pay: value }
                : { kind: value }
            )
            setCustomInput('')
          }}
        >
          {starter && (
            <Radio.Root
              value='starter'
              nativeButton
              render={<button type='button' />}
              className='bw-starter'
            >
              <GiftIcon className='bw-starter-ic' />
              <span className='bw-starter-main'>
                <span className='bw-starter-title'>
                  {t('Starter pack')}
                  <span className='bw-starter-tag'>
                    {t('Once per account')}
                  </span>
                </span>
                <span className='bw-starter-sub'>
                  <Trans
                    i18nKey='You get <b>{{amount}}</b> (incl. <g>{{bonus}}</g> bonus)'
                    values={{
                      amount: usd(
                        starter.quote.amount + starter.quote.bonus,
                        locale
                      ),
                      bonus: usd(starter.quote.bonus, locale),
                    }}
                    components={{ b: <b />, g: <b className='bw-bonus' /> }}
                  />
                </span>
              </span>
              <span className='bw-starter-price'>
                <b>{yuan(starter.quote.pay, locale)}</b>
                {starter.usual > starter.quote.pay && (
                  <s>
                    <span className='sr-only'>{t('Usual price')} </span>
                    {yuan(starter.usual, locale)}
                  </s>
                )}
              </span>
            </Radio.Root>
          )}
          {gift && (
            <Radio.Root
              value='gift'
              nativeButton
              render={<button type='button' />}
              className='bw-chip bw-giftchip'
            >
              {gift.title} {yuan(giftPay, locale)}
            </Radio.Root>
          )}
          {chips.map((chip, index) => {
            const chipQuote = quote(
              chip,
              props.price,
              tiers,
              null,
              chipMoney[index]
            )
            return (
              <Radio.Root
                key={chip}
                value={chip}
                nativeButton
                render={<button type='button' />}
                className='bw-chip'
              >
                {yuan(chipMoney[index] ?? chip, locale)}
                {chipQuote.rate > 0 && <sup>+{percent(chipQuote.rate)}%</sup>}
              </Radio.Root>
            )
          })}
        </RadioGroup>
        <label
          className={cn('bw-cin', choice.kind === 'custom' && 'bw-cin-on')}
        >
          <span aria-hidden='true'>¥</span>
          <input
            inputMode='numeric'
            value={custom}
            placeholder={t('Or enter an amount from {{min}} to {{max}} yuan', {
              min: CUSTOM_MIN,
              max: CUSTOM_MAX,
            })}
            aria-label={t('Custom amount in yuan')}
            onChange={(event) => {
              setPicked({ kind: 'custom' })
              setCustomInput(
                event.target.value.replaceAll(/\D/g, '').slice(0, 6)
              )
            }}
          />
        </label>
        <p className='bw-res' aria-live='polite'>
          {result}
        </p>
        {bonusNote && <p className='bw-fine'>{bonusNote}</p>}

        <div className='bw-lbl' id='bw-method-lbl'>
          {t('Payment method')}
        </div>
        <RadioGroup
          className='bw-meths'
          aria-labelledby='bw-method-lbl'
          value={method}
          onValueChange={(value: string) => setMethodInput(value)}
        >
          {props.methods.map((item) => (
            <Radio.Root
              key={item.type}
              value={item.type}
              nativeButton
              render={<button type='button' />}
              className='bw-meth'
              data-type={item.type}
            >
              <span className='bw-pm' aria-hidden='true'>
                {getPaymentIcon(item.type, 'bw-pm-ic', item.icon, item.name)}
              </span>
              {item.name}
            </Radio.Root>
          ))}
        </RadioGroup>
        {opened ? (
          <p className='bw-acct' role='status'>
            {t(
              'The cashier opened in a new tab. Come back here after paying and the balance updates by itself.'
            )}
          </p>
        ) : (
          props.account && (
            <p className='bw-acct'>
              {props.account.method
                ? t(
                    'Credited to this account: {{name}} (signed in with {{method}})',
                    props.account
                  )
                : t('Credited to this account: {{name}}', {
                    name: props.account.name,
                  })}
            </p>
          )
        )}
      </div>
    )
    footer = (
      <>
        <Button variant='outline' onClick={() => onOpenChange(false)}>
          {t('Cancel')}
        </Button>
        <Button
          className='sm:min-w-32'
          disabled={!canPay}
          aria-busy={opening || quoting}
          onClick={startPayment}
        >
          {charge > 0 && !belowMin
            ? t('Continue to pay {{amount}}', {
                amount: yuan(charge, locale),
              })
            : t('Continue to pay')}
          {quoting && (
            <Loader2
              aria-hidden='true'
              className='animate-spin motion-reduce:animate-none'
            />
          )}
        </Button>
      </>
    )
  }

  // The rate is left out when New API's quotes give no single one.
  let description: string | undefined
  if (tiers.length > 0) {
    const values = {
      rate,
      min: yuan(tiers[0].min, locale),
      max: percent(topRate),
    }
    description = rate
      ? t(
          '{{rate}}. Single payments from {{min}} get up to {{max}}% bonus.',
          values
        )
      : t('Single payments from {{min}} get up to {{max}}% bonus.', values)
  } else if (rate) {
    description = t('Exchange rate: {{rate}}', { rate })
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={forget}
      title={t('Top up')}
      description={description}
      // The body's 4px focus-ring padding plus gap-3 keeps the 16px rhythm.
      contentClassName='bw-dlg gap-3 sm:max-w-[480px] sm:p-4'
      footerClassName='sm:-mx-4 sm:-mb-4 sm:p-4'
      footer={footer}
    >
      {content}
    </Dialog>
  )
}
