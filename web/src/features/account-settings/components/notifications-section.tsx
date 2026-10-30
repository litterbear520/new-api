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

import { NotificationTab } from '@/features/profile/components/tabs/notification-tab'
import type { UserProfile } from '@/features/profile/types'
import { useStatus } from '@/hooks/use-status'

import { SettingsGroup } from './settings-group'

/** 通知: how and when the balance warning reaches the user */
export function NotificationsSection(props: {
  profile: UserProfile
  onUpdate: () => void
}) {
  const { t } = useTranslation()
  const { status } = useStatus()
  return (
    <SettingsGroup
      id='settings-notifications'
      title={t('Notifications')}
      description={t('Where the low-balance warning goes, and when.')}
    >
      <div className='p-4'>
        <NotificationTab
          profile={props.profile}
          onUpdate={props.onUpdate}
          // Older cached status payloads lack these fields; the default is on.
          quotaRemindEnabled={status?.quota_remind_enabled !== false}
          quotaRemindThreshold={status?.quota_remind_threshold ?? 0}
        />
      </div>
    </SettingsGroup>
  )
}
