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
import type { TFunction } from 'i18next'
import { RefreshCw, TimerReset } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative } from '@/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import {
  REFRESH_MINUTES,
  SOON_DAYS,
  gmtLabel,
  hasReset,
  liveResets,
  newRequestId,
  quotaLevel,
  resetExpiry,
  resetParts,
  resetTime,
  subscription,
  type AccountQuota,
  type PlanTier,
  type QuotaWindowId,
  type ResetCards,
  type ResetResult,
} from '../lib/account-quota'

function windowLabel(t: TFunction, id: QuotaWindowId) {
  if (id === 'five_hour') return t('5-hour limit')
  if (id === 'weekly') return t('7-day limit')
  return t('Monthly limit')
}

const BAR_CLASS = {
  good: 'bo-qx-good',
  warn: 'bo-warn',
  bad: 'bo-qx-bad',
} as const

function resetMessage(t: TFunction, result: ResetResult) {
  switch (result) {
    case 'reset':
      return t('Quota reset. Both limits are full again.')
    case 'not_needed':
      return t('OpenAI says no reset is needed right now.')
    case 'no_credit':
      return t('No reset was used: there are no manual resets left.')
    case 'busy':
      return t('A reset was just tried. Wait a few seconds and try again.')
    case 'unknown':
      return t(
        "Couldn't confirm the reset. Trying again is safe: it can't use a second reset."
      )
    default:
      return t(
        "No reset was used: the account can't be read right now. Try again later."
      )
  }
}

function quotaValue(
  t: TFunction,
  reset: boolean,
  left: number,
  percent: Intl.NumberFormat
) {
  if (reset) return t('Has reset')
  if (left <= 0) return t('Used up')
  return t('{{percent}} left', { percent: percent.format(left / 100) })
}

/** The plan on a plate of its tier's material; plan names stay untranslated */
function Nameplate(props: { plan: string; tier: PlanTier }) {
  return (
    <span className={cn('bo-qx-np', `bo-qx-np-${props.tier}`)}>
      <span>{props.plan}</span>
      {props.tier === 'diamond' && (
        <svg viewBox='0 0 12 12' width='11' height='11' aria-hidden='true'>
          <path d='M6 0c.5 3.4 2.1 5 5.5 5.5v1C8.1 7 6.5 8.6 6 12h-.2C5.3 8.6 3.7 7 .3 6.5v-1C3.7 5 5.3 3.4 5.8 0z' />
        </svg>
      )}
    </span>
  )
}

/** When each manual reset expires */
function ResetExpiry(props: {
  resets: ResetCards
  now: Date
  locale: Intl.LocalesArgument
}) {
  const { t } = useTranslation()
  const soonBefore = props.now.getTime() / 1000 + SOON_DAYS * 86400
  // Sorted soonest first; only the one that expires first turns amber
  const first = props.resets.expiresAt[0]
  const firstSoon = first !== undefined && first < soonBefore
  return (
    <div className='bo-qx-rc'>
      <div className='bo-qx-rc-h'>
        {t('Manual reset expiry ({{timezone}})', {
          timezone: gmtLabel(-props.now.getTimezoneOffset()),
        })}
      </div>
      {Array.from({ length: props.resets.available }, (_, i) => {
        const at = props.resets.expiresAt[i]
        return (
          <div key={i} className='bo-qx-rc-row'>
            <span>{t('Reset {{index}}', { index: i + 1 })}</span>
            <span className={cn(i === 0 && firstSoon && 'bo-qx-soon')}>
              {at === undefined
                ? '—'
                : resetExpiry(at, props.now, props.locale)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 重置额度: spends one manual reset after a confirmation. It works whenever a
 * reset is left; the upstream decides whether the limits need it.
 */
function ResetButton(props: {
  resets: ResetCards
  now: Date
  locale: Intl.LocalesArgument
  onReset: (requestId: string) => Promise<ResetResult>
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [requestId, setRequestId] = useState('')
  const [pending, setPending] = useState(false)
  const [unsure, setUnsure] = useState(false)
  const notYet = props.resets.usable === 0
  const first = props.resets.expiresAt[0]

  let actionLabel = unsure ? t('Try again') : t('Reset now')
  if (pending) actionLabel = t('Resetting…')

  const openDialog = () => {
    // One id per confirmation; "Try again" below keeps it.
    setRequestId(newRequestId())
    setUnsure(false)
    setOpen(true)
  }

  const applyReset = async () => {
    setPending(true)
    const result = await props
      .onReset(requestId)
      .catch((): ResetResult => 'unknown')
    setPending(false)
    if (result === 'unknown') {
      setUnsure(true)
      return
    }
    setOpen(false)
    if (result === 'reset') toast.success(resetMessage(t, result))
    else toast.error(resetMessage(t, result))
  }

  return (
    <>
      <Button variant='ghost' size='xs' disabled={pending} onClick={openDialog}>
        <TimerReset data-icon='inline-start' aria-hidden='true' />
        {t('Reset quota')}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next)
        }}
        title={t('Reset quota?')}
        desc={
          <>
            <span className='block'>
              {t(
                'Uses 1 manual reset. The 5-hour and weekly limits go back to full right away.'
              )}
            </span>
            {first !== undefined && props.resets.available > 1 && (
              <span className='mt-1 block'>
                {t('The one that expires first is used ({{time}}).', {
                  time: resetTime(first, props.now, props.locale, t('Today')),
                })}
              </span>
            )}
          </>
        }
        confirmText={actionLabel}
        isLoading={pending}
        handleConfirm={() => void applyReset()}
      >
        {notYet && (
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            {t('There is still quota left, so a reset may change nothing.')}
          </p>
        )}
        {unsure && (
          <p className='text-destructive text-sm' role='alert'>
            {resetMessage(t, 'unknown')}
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}

/**
 * 专属号额度: the usage limits of the user's own group, under the wallet card;
 * the bars show what is left.
 */
export function AccountQuotaCard(props: {
  quota: AccountQuota
  refreshing: boolean
  onRefresh: () => void
  /** 重置额度; without it the card only lists the manual resets */
  onReset?: (requestId: string) => Promise<ResetResult>
  /** For tests; defaults to the current time */
  now?: number
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })
  const now = new Date(props.now ?? Date.now())
  const nowSeconds = Math.floor(now.getTime() / 1000)
  const sub = subscription(props.quota.provider, props.quota.plan)
  // The numbers can be old: nothing refreshes by itself, so a limit may have
  // reset, and a manual reset expired, since the last reading.
  const usedUp = props.quota.windows.some(
    (w) => w.left <= 0 && !hasReset(w, nowSeconds)
  )
  const live = liveResets(props.quota.resets, nowSeconds)
  const resets = !props.quota.error && live?.available ? live : null
  const waiting = nowSeconds < props.quota.nextRefreshAt
  const waitId = useId()
  // Re-render during the refresh wait: the minutes count down, then the button
  // comes back by itself.
  const [, setWoken] = useState(0)
  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => setWoken((n) => n + 1), 15 * 1000)
    return () => window.clearInterval(id)
  }, [waiting])

  return (
    <section
      className={cn('bo-card bo-qx', `bo-qx-tier-${sub.tier}`)}
      aria-labelledby='bo-qx-title'
    >
      <div className='bo-qx-h'>
        <div
          className={cn(
            'bo-qx-logo',
            props.quota.provider === 'claude' && 'bo-qx-logo-claude'
          )}
          aria-hidden='true'
        >
          {getLobeIcon(sub.icon, props.quota.provider === 'claude' ? 24 : 34)}
        </div>
        <div className='bo-qx-who'>
          <h2 id='bo-qx-title'>
            {sub.brand}
            {sub.plan && ' '}
            {sub.plan && <Nameplate plan={sub.plan} tier={sub.tier} />}
          </h2>
          <p className='bo-qx-desc'>
            {t('Dedicated account quota')} ·{' '}
            {t('Keys in the {{group}} group use only this account', {
              group: props.quota.group,
            })}
          </p>
        </div>
      </div>

      {props.quota.never && (
        <p className='bo-qx-empty'>
          {t('No quota reading yet. Select Refresh quota to see it.')}
        </p>
      )}
      {props.quota.error ? (
        <p className='bo-qx-empty'>{t("Can't read the quota right now.")}</p>
      ) : (
        props.quota.windows.map((w) => {
          const label = windowLabel(t, w.id)
          const reset = hasReset(w, nowSeconds)
          const left = reset ? 100 : Math.round(w.left)
          const level = quotaLevel(left)
          const when = w.resetAt ? resetParts(w.resetAt, now, locale) : null
          return (
            <div key={w.id} className='bo-qx-row'>
              <div className='bo-qx-top'>
                <span className='bo-qx-label'>{label}</span>
                <span className='bo-qx-val'>
                  <b className={`bo-qx-${level}-t`}>
                    {quotaValue(t, reset, left, percent)}
                  </b>
                  {reset && (
                    <span className='bo-qx-when'>
                      {t('Select Refresh quota for the latest')}
                    </span>
                  )}
                  {when && !reset && (
                    <span className='bo-qx-when'>
                      {when.date} ·{' '}
                      <span className={cn(when.soon && 'bo-qx-soon')}>
                        {when.until}
                      </span>
                    </span>
                  )}
                </span>
              </div>
              <div
                className={cn('bo-bar', BAR_CLASS[level])}
                role='meter'
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={left}
              >
                <i style={{ width: `${left}%` }} />
              </div>
            </div>
          )
        })
      )}

      {usedUp && (
        <p className='bo-qx-note'>
          {t(
            'Until it resets, keys in the {{group}} group return errors. If you need it now, use a key in the default group.',
            { group: props.quota.group }
          )}
        </p>
      )}

      {resets && <ResetExpiry resets={resets} now={now} locale={locale} />}

      <div className={cn('bo-qx-foot', props.quota.stale && 'bo-qx-old')}>
        <span>
          {props.quota.fetchedAt !== null &&
            t('Updated {{time}}', {
              time: formatTimestampRelative(
                props.quota.fetchedAt,
                'seconds',
                locale
              ),
            })}
          {props.quota.stale && ` · ${t('Numbers may have changed')}`}
        </span>
        <div className='bo-qx-acts'>
          {resets && props.onReset && (
            <ResetButton
              resets={resets}
              now={now}
              locale={locale}
              onReset={props.onReset}
            />
          )}
          <Button
            variant='ghost'
            size='xs'
            onClick={props.onRefresh}
            disabled={props.refreshing || waiting}
            aria-describedby={waiting ? waitId : undefined}
          >
            <RefreshCw
              data-icon='inline-start'
              aria-hidden='true'
              className={cn(props.refreshing && 'animate-spin')}
            />
            {t('Refresh quota')}
          </Button>
        </div>
      </div>
      {/* Visible text, not a title: touch screens never show a title */}
      {waiting && (
        <p id={waitId} className='bo-qx-wait'>
          {t(
            'One refresh every {{minutes}} minutes. Try again in {{wait}} min.',
            {
              minutes: REFRESH_MINUTES,
              wait: Math.ceil((props.quota.nextRefreshAt - nowSeconds) / 60),
            }
          )}
        </p>
      )}
    </section>
  )
}
