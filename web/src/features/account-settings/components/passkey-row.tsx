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
import { Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePasskeyManagement } from '@/features/auth/passkey'
import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'

import { SettingsRow } from './settings-group'

/** Passkey sign-in on one row: state, last use, enable or remove */
export function PasskeyRow() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const passkey = usePasskeyManagement()
  const verification = useSecureVerification()
  const busy = passkey.registering || passkey.removing || verification.isActive

  const register = useCallback(async () => {
    if (busy) return
    const proof = await verification.requestVerification({
      scope: 'passkey.register',
    })
    if (!proof) return
    try {
      await passkey.register(proof.proof_token)
      toast.success(t('Passkey registered successfully'))
    } catch (error) {
      const failure = AuthOperationError.from(error)
      if (failure.code !== 'AUTH_CANCELLED') handleServerError(failure)
    }
  }, [busy, passkey, t, verification])

  const remove = useCallback(async () => {
    if (busy) return
    setConfirmOpen(false)
    const proof = await verification.requestVerification({
      scope: 'passkey.delete',
    })
    if (!proof) return
    try {
      await passkey.remove(proof.proof_token)
      toast.success(t('Passkey removed successfully'))
    } catch (error) {
      const failure = AuthOperationError.from(error)
      if (failure.code !== 'AUTH_CANCELLED') handleServerError(failure)
    }
  }, [busy, passkey, t, verification])

  let value
  if (passkey.loading) {
    value = <Skeleton className='h-5 w-28' />
  } else if (passkey.statusError) {
    value = (
      <span role='alert' className='text-muted-foreground'>
        {t(passkey.statusError)}
      </span>
    )
  } else if (passkey.enabled) {
    const lastUsed =
      passkey.lastUsed && !Number.isNaN(Date.parse(passkey.lastUsed))
        ? formatTimestampRelative(
            Date.parse(passkey.lastUsed),
            'milliseconds',
            locale
          )
        : t('Not used yet')
    // 已备份 / 未备份 / 无备份, when the server knows whether the key syncs
    let backup: { label: string; variant: StatusVariant } | null = null
    if (passkey.status?.backup_eligible === false) {
      backup = { label: t('No backup'), variant: 'neutral' }
    } else if (passkey.status?.backup_eligible) {
      backup = passkey.status.backup_state
        ? { label: t('Backed up'), variant: 'success' }
        : { label: t('Not backed up'), variant: 'warning' }
    }
    value = (
      <span className='flex flex-wrap items-center gap-2'>
        <StatusBadge
          label={t('Enabled')}
          variant='success'
          showDot
          copyable={false}
        />
        {backup && (
          <StatusBadge
            label={backup.label}
            variant={backup.variant}
            showDot
            copyable={false}
          />
        )}
        <span className='text-muted-foreground text-xs'>
          {t('Last used:')} {lastUsed}
        </span>
      </span>
    )
  } else if (passkey.supported) {
    value = <span className='text-muted-foreground'>{t('Not set up')}</span>
  } else {
    value = (
      <span className='text-muted-foreground flex flex-col gap-0.5'>
        <span>{t('Passkey not supported on this device')}</span>
        <span className='text-xs'>
          {t(
            'Use a compatible browser or device with biometric authentication or a security key to register a Passkey.'
          )}
        </span>
      </span>
    )
  }

  let action = null
  if (passkey.statusError) {
    action = (
      <Button
        size='sm'
        variant='outline'
        onClick={() => void passkey.fetchStatus()}
      >
        {t('Retry')}
      </Button>
    )
  } else if (!passkey.loading && passkey.enabled) {
    action = (
      <Button
        size='sm'
        variant='outline'
        className='text-destructive'
        disabled={busy}
        onClick={() => setConfirmOpen(true)}
      >
        {passkey.removing && <Loader2 className='animate-spin' />}
        {t('Remove Passkey')}
      </Button>
    )
  } else if (!passkey.loading) {
    action = (
      <Button
        size='sm'
        variant='outline'
        disabled={!passkey.supported || busy}
        onClick={() => void register()}
      >
        {passkey.registering && <Loader2 className='animate-spin' />}
        {t('Enable Passkey')}
      </Button>
    )
  }

  return (
    <>
      <SettingsRow
        label={t('Passkey Login')}
        description={t(
          'Use Passkey to sign in without entering your password.'
        )}
        value={value}
      >
        {action}
      </SettingsRow>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('Remove Passkey?')}
        desc={t(
          'Removing Passkey will require you to sign in with your password next time. You can re-register anytime.'
        )}
        confirmText={t('Remove')}
        destructive
        isLoading={passkey.removing}
        handleConfirm={() => void remove()}
      />
      <SecureVerificationDialog {...verification.dialogProps} />
    </>
  )
}
