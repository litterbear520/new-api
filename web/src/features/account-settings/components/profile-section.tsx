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
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { money } from '@/features/bear-overview/lib/money'
import { useHeldCredit } from '@/features/bear-wallet/hooks/use-wallet-data'
import { CheckinCalendarCard } from '@/features/profile/components/checkin-calendar-card'
import { SidebarModulesCard } from '@/features/profile/components/sidebar-modules-card'
import { getDisplayName } from '@/features/profile/lib'
import type { UserProfile } from '@/features/profile/types'
import { useStatus } from '@/hooks/use-status'
import { toIntlLocale } from '@/i18n/languages'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatNumber, formatQuota, formatTimestamp } from '@/lib/format'
import { getRoleLabel } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { LanguageRow } from './language-row'
import { SettingsGroup, SettingsRow } from './settings-group'

/** 账户资料: who the account is, its balance and the interface language */
export function ProfileSection(props: {
  profile: UserProfile
  onUpdate: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { status } = useStatus()
  const permissions = useAuthStore((s) => s.auth.user?.permissions)
  const profile = props.profile
  const name = profile.username || getDisplayName(profile)
  const checkinEnabled = status?.checkin_enabled === true
  // Bonus and gift packs are spent first, so the balance counts them, as on
  // the overview and the wallet.
  const held = useHeldCredit()
  const balance = Number(profile.quota ?? 0) + held

  return (
    <div className='flex flex-col gap-4'>
      <SettingsGroup
        id='settings-account'
        title={t('Account details')}
        description={t('Your account on this site.')}
      >
        <SettingsRow
          label={t('Avatar')}
          description={t('Made from your username.')}
          value={
            <Avatar className='size-9 rounded-lg'>
              <AvatarFallback
                className='rounded-lg text-sm font-semibold text-white'
                style={getUserAvatarStyle(name)}
              >
                {getUserAvatarFallback(name)}
              </AvatarFallback>
            </Avatar>
          }
        />
        <SettingsRow
          label={t('Username')}
          value={
            <span className='flex flex-wrap items-baseline gap-x-2'>
              <span>{profile.username}</span>
              <span className='text-muted-foreground inline-flex items-center gap-0.5 text-xs'>
                {t('User ID')} {profile.id}
                <CopyButton
                  value={String(profile.id)}
                  className='size-6'
                  iconClassName='size-3'
                  aria-label={t('Copy {{field}}', { field: t('User ID') })}
                />
              </span>
            </span>
          }
        />
        <SettingsRow
          label={t('Display Name')}
          value={getDisplayName(profile)}
        />
        <SettingsRow
          label={t('Email')}
          description={t('Change it under Sign-in & security.')}
          value={
            profile.email || (
              <span className='text-muted-foreground'>{t('Not bound')}</span>
            )
          }
        />
        <SettingsRow label={t('Role')} value={getRoleLabel(profile.role)} />
        <SettingsRow label={t('Group')} value={profile.group || 'default'} />
        {profile.created_time > 0 && (
          <SettingsRow
            label={t('Signed up')}
            value={formatTimestamp(profile.created_time)}
          />
        )}
        <SettingsRow
          label={t('Balance')}
          value={
            <span className='tabular-nums'>
              {money(balance, locale)}
              {held > 0 && (
                <span className='text-muted-foreground ms-2 text-xs'>
                  {t('Includes {{amount}} with an expiry date', {
                    amount: money(held, locale),
                  })}
                </span>
              )}
            </span>
          }
        >
          <Button size='sm' variant='outline' render={<Link to='/wallet' />}>
            {t('Wallet')}
          </Button>
        </SettingsRow>
        <SettingsRow
          label={t('Total spent')}
          value={
            <span className='tabular-nums'>
              {formatQuota(profile.used_quota)}
              <span className='text-muted-foreground ms-2 text-xs'>
                {t('Requests: {{count}}', {
                  count: formatNumber(profile.request_count, locale),
                })}
              </span>
            </span>
          }
        />
      </SettingsGroup>

      <SettingsGroup
        id='settings-preferences'
        title={t('Preferences')}
        description={t('How the console looks for you.')}
      >
        <LanguageRow profile={profile} onUpdate={props.onUpdate} />
      </SettingsGroup>

      {checkinEnabled && (
        <CheckinCalendarCard
          checkinEnabled={checkinEnabled}
          turnstileEnabled={Boolean(
            status?.turnstile_check && status?.turnstile_site_key
          )}
          turnstileSiteKey={status?.turnstile_site_key || ''}
        />
      )}
      {permissions?.sidebar_settings !== false && <SidebarModulesCard />}
    </div>
  )
}
