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
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SecureVerificationDialog } from '@/features/auth/secure-verification'
import { TwoFABackupDialog } from '@/features/security/components/dialogs/two-fa-backup-dialog'
import { TwoFADisableDialog } from '@/features/security/components/dialogs/two-fa-disable-dialog'
import { TwoFASetupDialog } from '@/features/security/components/dialogs/two-fa-setup-dialog'
import { useTwoFA } from '@/features/security/hooks/use-two-fa'
import { useTwoFASetup } from '@/features/security/hooks/use-two-fa-setup'
import { useDialogs } from '@/hooks/use-dialog'

import { SettingsRow } from './settings-group'

type DialogKey = 'disable' | 'backup'

/** Two-step verification on one row: state, backup codes, enable or turn off */
export function TwoFARow() {
  const { t } = useTranslation()
  const { status, loading, error, refetch } = useTwoFA(true)
  const dialogs = useDialogs<DialogKey>()
  const setup = useTwoFASetup(refetch)

  let value
  let action
  if (loading) {
    value = <Skeleton className='h-5 w-28' />
    action = null
  } else if (error) {
    value = (
      <span role='alert' className='text-muted-foreground'>
        {t(error)}
      </span>
    )
    action = (
      <Button size='sm' variant='outline' onClick={() => void refetch()}>
        {t('Retry')}
      </Button>
    )
  } else if (status.enabled) {
    value = (
      <span className='flex flex-wrap items-center gap-2'>
        <StatusBadge
          label={t('Enabled')}
          variant='success'
          showDot
          copyable={false}
        />
        {status.locked && (
          <StatusBadge
            label={t('Locked')}
            variant='danger'
            showDot
            copyable={false}
          />
        )}
        <span className='text-muted-foreground text-xs'>
          {t('Backup codes remaining: {{count}}', {
            count: status.backup_codes_remaining,
          })}
        </span>
      </span>
    )
    action = (
      <>
        <Button
          size='sm'
          variant='outline'
          onClick={() => dialogs.open('backup')}
        >
          {t('Regenerate Backup Codes')}
        </Button>
        <Button
          size='sm'
          variant='outline'
          className='text-destructive'
          onClick={() => dialogs.open('disable')}
        >
          {t('Disable 2FA')}
        </Button>
      </>
    )
  } else {
    value = <span className='text-muted-foreground'>{t('Not set up')}</span>
    action = (
      <Button
        size='sm'
        variant='outline'
        disabled={setup.active}
        onClick={setup.start}
      >
        {t('Enable')}
      </Button>
    )
  }

  return (
    <>
      <SettingsRow
        label={t('Two-Factor Authentication')}
        description={t('Add an extra layer of security to your account')}
        value={value}
      >
        {action}
      </SettingsRow>
      <SecureVerificationDialog {...setup.verificationDialogProps} />
      <TwoFASetupDialog
        key={setup.setupDialogProps.setupData?.flow_token ?? 'initializing'}
        {...setup.setupDialogProps}
      />
      <TwoFADisableDialog
        open={dialogs.isOpen('disable')}
        onOpenChange={(open) =>
          open ? dialogs.open('disable') : dialogs.close('disable')
        }
        onSuccess={refetch}
      />
      <TwoFABackupDialog
        open={dialogs.isOpen('backup')}
        onOpenChange={(open) =>
          open ? dialogs.open('backup') : dialogs.close('backup')
        }
        onSuccess={refetch}
      />
    </>
  )
}
