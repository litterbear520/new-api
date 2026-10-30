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
import { Bell, ClipboardList, ShieldCheck, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { SettingsSection } from '../constants'

const ICONS = {
  profile: UserRound,
  security: ShieldCheck,
  notifications: Bell,
  audit: ClipboardList,
} satisfies Record<SettingsSection, unknown>

/** The section list: a column on the left, a scrolling row on phones */
export function SectionNav(props: {
  sections: SettingsSection[]
  current: SettingsSection
}) {
  const { t } = useTranslation()
  const label: Record<SettingsSection, string> = {
    profile: t('Account details'),
    security: t('Sign-in & security'),
    notifications: t('Notifications'),
    audit: t('Audit Logs'),
  }
  return (
    <nav
      aria-label={t('Account settings')}
      className='min-w-0 md:sticky md:top-0 md:self-start md:in-[[data-page-scroll]]:top-[calc(var(--app-header-height)+1rem)]'
    >
      <ul className='-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0'>
        {props.sections.map((section) => {
          const Icon = ICONS[section]
          const active = section === props.current
          return (
            <li key={section} className='shrink-0'>
              <Link
                to='/profile'
                search={section === 'profile' ? {} : { section }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
                  active && 'bg-muted text-foreground font-medium'
                )}
              >
                <Icon className='size-4 shrink-0' aria-hidden='true' />
                {label[section]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
