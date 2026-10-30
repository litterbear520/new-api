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
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Switch } from '@/components/ui/switch'
import { updateUserSettings } from '@/features/profile/api'
import { parseUserSettings } from '@/features/profile/lib/format'
import type { UserProfile } from '@/features/profile/types'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import { SettingsRow } from './settings-group'

/** 记录 IP 地址: saved as soon as the switch moves */
export function PrivacyRow(props: {
  profile: UserProfile
  onUpdate: () => void
}) {
  const { t } = useTranslation()
  const saved = Boolean(parseUserSettings(props.profile.setting).record_ip_log)
  const [on, setOn] = useState(saved)
  useEffect(() => setOn(saved), [saved])

  const save = useMutation({
    mutationFn: async (next: boolean) => {
      const response = await updateUserSettings({ record_ip_log: next })
      if (!response.success) {
        throw createServerError(response, t('Failed to update settings'))
      }
    },
    onSuccess: () => {
      toast.success(t('Settings updated successfully'))
      props.onUpdate()
    },
    onError: (error) => {
      setOn(saved)
      handleServerError(error, t('Failed to update settings'))
    },
  })

  return (
    <SettingsRow
      label={
        <label htmlFor='settings-record-ip'>{t('Record IP Address')}</label>
      }
      description={t('Log IP address for usage and error logs')}
    >
      <Switch
        id='settings-record-ip'
        checked={on}
        disabled={save.isPending}
        onCheckedChange={(next) => {
          setOn(next)
          save.mutate(next)
        }}
      />
    </SettingsRow>
  )
}
