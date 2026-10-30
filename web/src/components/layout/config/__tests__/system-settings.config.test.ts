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
import { describe, expect, it } from 'vitest'

import {
  isSystemSettingsNavLoaded,
  loadSystemSettingsNav,
  SYSTEM_SETTINGS_VIEW,
} from '../system-settings.config'

const t = ((key: string) => key) as unknown as TFunction

describe('System Settings sidebar view', () => {
  it('loads its nav groups on demand instead of with every page', async () => {
    expect(isSystemSettingsNavLoaded()).toBe(false)
    expect(SYSTEM_SETTINGS_VIEW.getNavGroups(t)).toEqual([])

    await loadSystemSettingsNav()

    expect(isSystemSettingsNavLoaded()).toBe(true)
    const [group] = SYSTEM_SETTINGS_VIEW.getNavGroups(t)
    expect(group.id).toBe('system-administration')
    expect(group.items.map((item) => item.title)).toEqual([
      'Site & Branding',
      'Authentication',
      'Billing & Payment',
      'Models',
      'Request policies',
      'Security & Limits',
      'Console Content',
      'Operations',
    ])
  })
})
