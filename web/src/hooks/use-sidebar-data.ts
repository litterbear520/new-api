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
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Box,
  ClipboardList,
  CreditCard,
  FileText,
  Gift,
  Image as ImageIcon,
  Key,
  MessageCircle,
  MessageSquare,
  PlugZap,
  Radio,
  ServerCog,
  Settings,
  ShieldCheck,
  Ticket,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SidebarData } from '@/components/layout/types'
import { useStatus } from '@/hooks/use-status'
import { ROLE } from '@/lib/roles'
import { useDrawDotStore } from '@/stores/draw-dot-store'

/**
 * Root navigation groups for the application sidebar.
 *
 * These are shown when the URL does not match any nested sidebar view
 * registered in `layout/lib/sidebar-view-registry.ts`.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsLink = (status?.docs_link as string | undefined) || '/docs/'
  const drawDot = useDrawDotStore((s) => s.dot)
  let drawDotLabel: string | undefined
  if (drawDot === 'new') drawDotLabel = t('New')
  if (drawDot === 'done') drawDotLabel = t('Drawing finished')

  return {
    navGroups: [
      {
        id: 'chat',
        items: [
          {
            title: t('Chat'),
            url: '/playground',
            icon: MessageCircle,
          },
          {
            title: t('Draw pictures'),
            url: '/draw',
            // the old drawing page stays reachable and belongs here too
            activeUrls: ['/draw/classic'],
            icon: ImageIcon,
            dot: drawDotLabel,
          },
          {
            title: t('Chat apps'),
            icon: MessageSquare,
            type: 'chat-presets',
          },
        ],
      },
      {
        id: 'general',
        items: [
          {
            title: t('Overview'),
            url: '/dashboard/overview',
            icon: Activity,
          },
          {
            title: t('API Keys'),
            url: '/keys',
            icon: Key,
          },
          {
            title: t('Usage statistics'),
            url: '/dashboard/models',
            // the admin sections of the same page
            activeUrls: ['/dashboard/flow', '/dashboard/users'],
            icon: BarChart3,
          },
          {
            // task and drawing logs are tabs on the same page
            title: t('Usage Logs'),
            url: '/usage-logs/common',
            activeUrls: ['/usage-logs/task', '/usage-logs/drawing'],
            icon: FileText,
          },
          {
            title: t('Wallet'),
            url: '/wallet',
            icon: Wallet,
          },
          {
            title: t('Invite rewards'),
            url: '/invite',
            icon: Gift,
          },
        ],
      },
      {
        // 账户设置 and its sections, reached from the account menu at the
        // bottom of the sidebar; each section keeps its old page's visibility
        id: 'account',
        searchOnly: true,
        items: [
          {
            title: t('Account settings'),
            url: '/profile',
            // the personal switch lives on this page, so it can't hide it
            alwaysVisible: true,
            icon: UserRound,
          },
          {
            title: t('Sign-in & security'),
            url: '/profile',
            search: { section: 'security' },
            configUrls: ['/security'],
            icon: ShieldCheck,
          },
          {
            title: t('Notifications'),
            url: '/profile',
            search: { section: 'notifications' },
            icon: Bell,
          },
          {
            title: t('Audit Logs'),
            url: '/profile',
            search: { section: 'audit' },
            configUrls: ['/usage-logs/audit'],
            icon: ClipboardList,
          },
        ],
      },
      {
        // in the top bar's dock now (and the sidebar's site links on
        // narrow screens); kept here so ⌘K still finds them
        id: 'links',
        searchOnly: true,
        items: [
          {
            title: t('Model Square'),
            url: '/pricing',
            icon: Box,
            external: true,
          },
          {
            title: t('Docs'),
            url: docsLink,
            icon: BookOpen,
            external: true,
          },
        ],
      },
      {
        id: 'admin',
        title: t('Admin'),
        items: [
          {
            title: t('Channels'),
            url: '/channels',
            icon: Radio,
          },
          {
            title: t('Models'),
            url: '/models/metadata',
            icon: Box,
          },
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('Redemption Codes'),
            url: '/redemption-codes',
            icon: Ticket,
          },
          {
            title: t('Subscriptions'),
            url: '/subscriptions',
            icon: CreditCard,
          },
          {
            title: t('System Info'),
            url: '/system-info',
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('Task Plugins'),
            url: '/task-plugins',
            icon: PlugZap,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('System Settings'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: Settings,
            requiredRole: ROLE.SUPER_ADMIN,
          },
        ],
      },
    ],
  }
}
