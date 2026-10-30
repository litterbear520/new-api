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
import type { TFunction } from 'i18next'

import type { NavGroup, SidebarView } from '../types'

/*
 * The section registries import every settings page, so the nav groups are a
 * chunk of their own: the settings route loads them before it renders (see
 * routes/_authenticated/system-settings/route.tsx), other pages never do.
 */
type NavBuilder = (t: TFunction) => NavGroup[]

let buildNav: NavBuilder | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

export function loadSystemSettingsNav(): Promise<void> {
  loading ??= import('./system-settings-nav').then(
    (m) => {
      buildNav = m.getSystemSettingsNavGroups
      listeners.forEach((notify) => notify())
    },
    (error: unknown) => {
      loading = null
      throw error
    }
  )
  return loading
}

/** For useSyncExternalStore: the sidebar re-renders once the groups are in. */
export function subscribeSystemSettingsNav(notify: () => void): () => void {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

export function isSystemSettingsNavLoaded(): boolean {
  return buildNav !== null
}

/**
 * Nested sidebar view for `/system-settings/*`.
 *
 * Activates the Vercel / Cloudflare-style drill-in sidebar:
 * the root navigation is replaced by the system administration
 * groups, with a "Back to Dashboard" affordance in the header.
 */
export const SYSTEM_SETTINGS_VIEW: SidebarView = {
  id: 'system-settings',
  pathPattern: /^\/system-settings(\/|$)/,
  parent: {
    to: '/dashboard/overview',
    label: 'Back to Dashboard',
  },
  getNavGroups: (t) => {
    if (buildNav) return buildNav(t)
    loadSystemSettingsNav().catch(() => undefined)
    return []
  },
}
