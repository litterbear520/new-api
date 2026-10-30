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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Combobox } from '@/components/ui/combobox'
import { updateUserLanguage } from '@/features/profile/api'
import { parseUserSettings } from '@/features/profile/lib'
import type { UserProfile } from '@/features/profile/types'
import {
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
} from '@/i18n/languages'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { SettingsRow } from './settings-group'

/** Interface language, saved to the account so every device follows it */
export function LanguageRow(props: {
  profile: UserProfile
  onUpdate: () => void
}) {
  const { t, i18n } = useTranslation()
  const { auth } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const saved = useMemo(() => {
    const settings = parseUserSettings(props.profile.setting)
    return normalizeInterfaceLanguage(settings.language || i18n.language)
  }, [props.profile.setting, i18n.language])
  const [current, setCurrent] = useState(saved)
  useEffect(() => setCurrent(saved), [saved])

  const change = async (language: string | null) => {
    if (!language) return
    const next = normalizeInterfaceLanguage(language)
    if (next === current) return
    const previous = current
    setCurrent(next)
    setSaving(true)
    await i18n.changeLanguage(next)
    try {
      const response = await updateUserLanguage(next)
      if (!response.success) {
        throw createServerError(response, t('Failed to update settings'))
      }
      if (auth.user) {
        const existing =
          typeof auth.user.setting === 'string'
            ? parseUserSettings(auth.user.setting)
            : (auth.user.setting ?? {})
        auth.setUser({
          ...auth.user,
          setting: JSON.stringify({ ...existing, language: next }),
        })
      }
      props.onUpdate()
      toast.success(t('Language preference saved'))
    } catch (error) {
      setCurrent(previous)
      await i18n.changeLanguage(previous)
      handleServerError(error, t('Failed to update settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsRow
      label={t('Interface Language')}
      description={t(
        'Language preferences sync across your signed-in devices and affect API error messages.'
      )}
    >
      {saving && (
        <Loader2 className='text-muted-foreground size-4 animate-spin' />
      )}
      <Combobox
        options={INTERFACE_LANGUAGE_OPTIONS.map((language) => ({
          value: language.code,
          label: language.label,
        }))}
        value={current}
        onValueChange={(value) => void change(value)}
        disabled={saving}
        className='w-44'
        placeholder={t('Select language')}
      />
    </SettingsRow>
  )
}
