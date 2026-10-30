import type { TFunction } from 'i18next'
import { RefreshCw, TimerReset } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  LOW_LEFT,
  REFRESH_MINUTES,
  SOON_DAYS,
  STALE_AFTER_SECONDS,
  gmtLabel,
  newRequestId,
  planLabel,
  quotaLevel,
  resetExpiry,
  resetTime,
  type AccountQuota,
  type QuotaWindowId,
  type ResetCards,
  type ResetResult,
} from '../lib/account-quota'

function windowLabel(t: TFunction, id: QuotaWindowId) {
  if (id === 'five_hour') return t('5-hour limit')
  if (id === 'weekly') return t('Weekly limit')
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
  const plan = planLabel(props.quota.plan)
  const usedUp = props.quota.windows.some((w) => w.left <= 0)
  const resets =
    !props.quota.error && props.quota.resets?.available
      ? props.quota.resets
      : null
  const old =
    props.quota.fetchedAt !== null &&
    (props.quota.stale ||
      nowSeconds - props.quota.fetchedAt > STALE_AFTER_SECONDS)
  const waiting = nowSeconds < props.quota.nextRefreshAt
  const waitId = useId()
  // Re-render when the refresh wait ends so the button comes back by itself.
  const [, setWoken] = useState(0)
  useEffect(() => {
    if (!waiting) return
    const id = window.setTimeout(
      () => setWoken((n) => n + 1),
      (props.quota.nextRefreshAt - nowSeconds) * 1000 + 500
    )
    return () => window.clearTimeout(id)
  }, [waiting, props.quota.nextRefreshAt, nowSeconds])

  return (
    <section className='bo-card bo-qx' aria-labelledby='bo-qx-title'>
      <div className='bo-qx-h'>
        <h2 id='bo-qx-title'>{t('Dedicated account quota')}</h2>
        {plan && <span className='bo-qx-plan'>{plan}</span>}
      </div>
      <p className='bo-qx-desc'>
        {t('Keys in the {{group}} group use only this account', {
          group: props.quota.group,
        })}
      </p>

      {props.quota.error ? (
        <p className='bo-qx-empty'>{t("Can't read the quota right now.")}</p>
      ) : (
        props.quota.windows.map((w) => {
          const label = windowLabel(t, w.id)
          const left = Math.round(w.left)
          const level = quotaLevel(left)
          const when = w.resetAt
            ? resetTime(w.resetAt, now, locale, t('Today'))
            : null
          let sub = when ? t('Resets {{time}}', { time: when }) : ''
          if (left <= 0 && when) sub = t('Back {{time}}', { time: when })
          else if (left <= LOW_LEFT) {
            sub = [t('Almost used up'), sub].filter(Boolean).join(' · ')
          }
          return (
            <div key={w.id} className='bo-qx-row'>
              <div className='bo-qx-top'>
                <span>{label}</span>
                <b className={`bo-qx-${level}-t`}>
                  {left <= 0
                    ? t('Used up')
                    : t('{{percent}} left', {
                        percent: percent.format(left / 100),
                      })}
                </b>
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
              {sub && <div className='bo-qx-sub'>{sub}</div>}
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

      <div className={cn('bo-qx-foot', old && 'bo-qx-old')}>
        <span>
          {props.quota.fetchedAt !== null &&
            t('Updated {{time}}', {
              time: formatTimestampRelative(
                props.quota.fetchedAt,
                'seconds',
                locale
              ),
            })}
          {old && ` · ${t('Numbers may have changed')}`}
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
            {t('Refresh')}
          </Button>
        </div>
      </div>
      {/* Visible text, not a title: touch screens never show a title */}
      {waiting && (
        <p id={waitId} className='bo-qx-wait'>
          {t('Refreshes at most once every {{minutes}} minutes', {
            minutes: REFRESH_MINUTES,
          })}
        </p>
      )}
    </section>
  )
}
