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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/features/profile/hooks/use-profile'
import { useIsSidebarModuleVisible } from '@/hooks/use-sidebar-config'
import { cn } from '@/lib/utils'

import { AuditSection } from './components/audit-section'
import { NotificationsSection } from './components/notifications-section'
import { ProfileSection } from './components/profile-section'
import { SectionNav } from './components/section-nav'
import { SecuritySection } from './components/security-section'
import type { SettingsSection } from './constants'

/**
 * 账户设置, after OpenModel's: one page with the sections listed on the left
 * (账户资料, 登录与安全, 通知, 审计日志) and each section's rows on the right.
 * It replaces the separate 个人资料 and 安全与访问 pages.
 */
export function AccountSettings(props: { section?: SettingsSection }) {
  const { t } = useTranslation()
  const { profile, loading, refreshProfile, fetchProfile } = useProfile()
  const auditVisible = useIsSidebarModuleVisible('/usage-logs/audit')

  // 登录与安全 is always listed: the sidebar switch for it only hides links,
  // never the password, 2FA, sessions or account deletion.
  const sections: SettingsSection[] = ['profile', 'security', 'notifications']
  if (auditVisible) sections.push('audit')
  const current =
    props.section && sections.includes(props.section)
      ? props.section
      : 'profile'

  let content: ReactNode
  if (current === 'audit') {
    content = <AuditSection />
  } else if (loading) {
    content = (
      <div role='status' aria-label={t('Loading...')} className='space-y-4'>
        <Skeleton className='h-72 w-full rounded-xl' />
        <Skeleton className='h-24 w-full rounded-xl' />
      </div>
    )
  } else if (!profile) {
    content = (
      <ErrorState
        title={t('Failed to load profile')}
        description={t('Refresh the list and try again.')}
        onRetry={() => void fetchProfile()}
      />
    )
  } else if (current === 'security') {
    content = <SecuritySection profile={profile} onUpdate={refreshProfile} />
  } else if (current === 'notifications') {
    content = (
      <NotificationsSection profile={profile} onUpdate={refreshProfile} />
    )
  } else {
    content = <ProfileSection profile={profile} onUpdate={refreshProfile} />
  }

  return (
    <SectionPageLayout fixedContent={current === 'audit'}>
      <SectionPageLayout.Title>{t('Account settings')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Manage your account details, how you sign in and notifications.')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div
          className={cn(
            'grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-6',
            // The audit table scrolls inside a page that does not.
            current === 'audit' &&
              'h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]'
          )}
        >
          <SectionNav sections={sections} current={current} />
          <div
            className={
              current === 'audit'
                ? 'flex min-h-0 min-w-0 flex-col'
                : 'max-w-3xl min-w-0'
            }
          >
            {content}
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
