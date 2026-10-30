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
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { money, quotaPerUnit } from '@/features/bear-overview/lib/money'
import { usd } from '@/features/bear-wallet/lib/format'
import type { InviteRule } from '@/features/bear-wallet/lib/rules'
import { toIntlLocale } from '@/i18n/languages'

/**
 * Whether rewards may move to the balance: blocked until the administrator
 * confirms the payment compliance terms, waiting while that is unknown
 */
export type TransferState = 'open' | 'waiting' | 'blocked'

function Stat(props: { label: string; value: string; note: string }) {
  return (
    <div className='min-w-0'>
      <div className='text-muted-foreground text-xs'>{props.label}</div>
      <div className='mt-1 text-lg font-semibold tabular-nums'>
        {props.value}
      </div>
      <div className='text-muted-foreground text-xs'>{props.note}</div>
    </div>
  )
}

/**
 * The link to share with three steps under it, and on the right what waits
 * to be moved to the balance (New API keeps invite rewards apart until then).
 */
export function InviteSummary(props: {
  link: string
  loadingLink: boolean
  invite: InviteRule | null
  /** Quota units: waiting, earned in total */
  pending: number
  earned: number
  invited: number
  transferring: boolean
  transfer: TransferState
  onMove: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const invite = props.invite
  const canMove =
    props.transfer === 'open' &&
    props.pending >= quotaPerUnit() &&
    !props.transferring

  const steps = [
    t('Copy the link and send it to a friend'),
    invite && invite.invitee > 0
      ? t('They sign up with it and get {{amount}} extra', {
          amount: usd(invite.invitee, locale),
        })
      : t('They sign up with it'),
    invite && invite.inviter > 0
      ? t('You get {{amount}}; move it to your balance to use it', {
          amount: usd(invite.inviter, locale),
        })
      : t('You get a reward; move it to your balance to use it'),
  ]

  return (
    <section
      aria-label={t('Your invite link')}
      className='bg-card grid overflow-hidden rounded-lg border lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]'
    >
      <div className='flex flex-col p-4 sm:p-5'>
        <label htmlFor='invite-link' className='text-muted-foreground text-xs'>
          {t('Your invite link')}
        </label>
        <div className='mt-2 mb-5 flex gap-2'>
          {props.loadingLink ? (
            <Skeleton className='h-9 flex-1' />
          ) : (
            <Input
              id='invite-link'
              readOnly
              value={props.link}
              className='bg-muted/40 font-mono text-xs'
              onFocus={(event) => event.currentTarget.select()}
            />
          )}
          {props.link ? (
            <CopyButton
              value={props.link}
              variant='default'
              size='default'
              aria-label={t('Copy link')}
            >
              {t('Copy link')}
            </CopyButton>
          ) : (
            // CopyButton has no disabled state: hold its place until the
            // link has loaded.
            <Button disabled>
              <Copy aria-hidden='true' />
              {t('Copy link')}
            </Button>
          )}
        </div>
        <ol className='grid gap-3 border-t pt-4 text-sm sm:grid-cols-3 lg:mt-auto'>
          {steps.map((step, index) => (
            <li key={step} className='flex gap-2.5'>
              <span
                aria-hidden='true'
                className='bg-muted text-muted-foreground grid size-5 shrink-0 place-items-center rounded-full text-xs font-medium'
              >
                {index + 1}
              </span>
              <span className='text-muted-foreground'>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className='border-t p-4 sm:p-5 lg:border-s lg:border-t-0'>
        <div className='text-muted-foreground text-xs'>
          {t('Waiting to move')}
        </div>
        <div className='mt-1 flex items-center justify-between gap-3'>
          <span className='text-2xl font-semibold tabular-nums'>
            {money(props.pending, locale)}
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={!canMove}
            onClick={props.onMove}
          >
            {t('Move to balance')}
          </Button>
        </div>
        <p className='text-muted-foreground mt-1 text-xs'>
          {props.transfer !== 'blocked'
            ? t(
                'Moves from {{min}}; then it is spent like the rest of your balance.',
                {
                  min: usd(1, locale),
                }
              )
            : t(
                'Referral reward transfer is disabled until the administrator confirms compliance terms.'
              )}
        </p>
        <div className='mt-4 grid grid-cols-2 gap-4 border-t pt-4'>
          <Stat
            label={t('Earned in total')}
            value={money(props.earned, locale)}
            note={t('All invite rewards')}
          />
          <Stat
            label={t('Friends invited')}
            value={String(props.invited)}
            note={t('Signed up with your link')}
          />
        </div>
      </div>
    </section>
  )
}
