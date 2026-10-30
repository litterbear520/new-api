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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { UserProfile } from '@/features/profile/types'
import { AccessTokensCard } from '@/features/security/components/access-tokens-card'
import { AccountBindings } from '@/features/security/components/account-bindings'
import { ChangePasswordDialog } from '@/features/security/components/dialogs/change-password-dialog'
import { DeleteAccountDialog } from '@/features/security/components/dialogs/delete-account-dialog'
import { LoginSessionsCard } from '@/features/security/components/login-sessions-card'

import { PasskeyRow } from './passkey-row'
import { PrivacyRow } from './privacy-row'
import { SettingsGroup, SettingsRow } from './settings-group'
import { TwoFARow } from './two-fa-row'

/**
 * 登录与安全: how the user signs in, the accounts linked to it, the devices
 * and tokens that can act for it, and deleting it.
 */
export function SecuritySection(props: {
  profile: UserProfile
  onUpdate: () => void
}) {
  const { t } = useTranslation()
  const [dialog, setDialog] = useState<'password' | 'delete' | null>(null)
  const hasPassword = props.profile.has_password !== false

  return (
    <div className='flex flex-col gap-4'>
      <SettingsGroup
        id='settings-sign-in'
        title={t('Sign-in')}
        description={t('What you use to sign in to the console.')}
      >
        <SettingsRow
          label={t('Password')}
          value={
            hasPassword ? (
              t('Password set')
            ) : (
              <span className='text-muted-foreground'>{t('Not set up')}</span>
            )
          }
        >
          <Button
            size='sm'
            variant='outline'
            onClick={() => setDialog('password')}
          >
            {hasPassword ? t('Change Password') : t('Set Password')}
          </Button>
        </SettingsRow>
        <PasskeyRow />
        <TwoFARow />
      </SettingsGroup>

      <SettingsGroup
        id='settings-bindings'
        title={t('Account Bindings')}
        description={t(
          'Sign in with any of these, and change your email here.'
        )}
      >
        <AccountBindings profile={props.profile} onUpdate={props.onUpdate} />
      </SettingsGroup>

      <LoginSessionsCard />
      <AccessTokensCard />

      <SettingsGroup id='settings-privacy' title={t('Privacy')}>
        <PrivacyRow profile={props.profile} onUpdate={props.onUpdate} />
      </SettingsGroup>

      <SettingsGroup id='settings-delete' title={t('Account Actions')}>
        <SettingsRow
          danger
          label={t('Delete Account')}
          description={t('Permanently delete your account and all data')}
        >
          <Button
            size='sm'
            variant='destructive'
            onClick={() => setDialog('delete')}
          >
            {t('Delete Account')}
          </Button>
        </SettingsRow>
      </SettingsGroup>

      <ChangePasswordDialog
        open={dialog === 'password'}
        onOpenChange={(open) => setDialog(open ? 'password' : null)}
        username={props.profile.username}
        hasPassword={props.profile.has_password}
        onSuccess={props.onUpdate}
      />
      <DeleteAccountDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : null)}
        username={props.profile.username}
      />
    </div>
  )
}
