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

import { Button } from '@/components/ui/button'
import { AuditLogViewer } from '@/features/usage-logs/audit/components/audit-log-viewer'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
} from '@/lib/admin-permissions'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

/**
 * 审计日志: the user's own security and account records. Admins who may read
 * everyone's records get a link to the full page.
 */
export function AuditSection() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const canReadAll =
    !!user &&
    user.role >= ROLE.ADMIN &&
    hasPermission(
      user,
      ADMIN_PERMISSION_RESOURCES.AUDIT,
      ADMIN_PERMISSION_ACTIONS.READ
    )

  return (
    <section
      aria-labelledby='settings-audit-title'
      className='flex h-full min-h-[480px] flex-col gap-3'
    >
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div>
          <h2
            id='settings-audit-title'
            className='text-base leading-snug font-medium'
          >
            {t('Audit Logs')}
          </h2>
          <p className='text-muted-foreground mt-1 text-sm'>
            {t('Sign-ins, setting changes and other actions on your account.')}
          </p>
        </div>
        {canReadAll && (
          <Button
            size='sm'
            variant='outline'
            render={<Link to='/usage-logs/audit' />}
          >
            {t('All users’ records')}
          </Button>
        )}
      </div>
      <div className='min-h-0 flex-1'>
        <AuditLogViewer key={user?.id} scope='self' />
      </div>
    </section>
  )
}
