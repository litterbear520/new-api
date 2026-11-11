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
import { describe, expect, test } from 'vitest'

import {
  getApiKeyFormDefaultValues,
  keyUsesMoreSettings,
  type ApiKeyFormValues,
} from '../api-key-form'

const plainSite = getApiKeyFormDefaultValues(false)
const autoSite = getApiKeyFormDefaultValues(true)

function saved(over: Partial<ApiKeyFormValues>): ApiKeyFormValues {
  return { ...plainSite, ...over }
}

describe('a new key', () => {
  test('starts in the default group, not the user group', () => {
    expect(plainSite.group).toBe('default')
  })

  test('starts in Auto when the site defaults to it', () => {
    expect(autoSite.group).toBe('auto')
  })
})

describe('whether a saved key uses More settings', () => {
  test.each([
    ['the empty group', ''],
    ['the default group', 'default'],
  ])('a key in %s with nothing else set does not', (_label, group) => {
    expect(keyUsesMoreSettings(saved({ group }), plainSite)).toBe(false)
  })

  test('a key in another group does', () => {
    expect(keyUsesMoreSettings(saved({ group: 'team_a' }), plainSite)).toBe(
      true
    )
  })

  test('an Auto key does when Auto is not the site default', () => {
    expect(
      keyUsesMoreSettings(
        saved({ group: 'auto', cross_group_retry: true }),
        plainSite
      )
    ).toBe(true)
  })

  test('an Auto key like a new one does not when Auto is the site default', () => {
    expect(
      keyUsesMoreSettings(
        saved({ group: 'auto', cross_group_retry: true }),
        autoSite
      )
    ).toBe(false)
  })

  test.each([
    ['cross-group retry turned off', { cross_group_retry: false }],
    [
      'its own Auto order',
      { auto_groups_mode: 'custom' as const, auto_groups: ['default'] },
    ],
  ])(
    'an Auto key with %s does when Auto is the site default',
    (_label, over) => {
      expect(
        keyUsesMoreSettings(
          saved({ group: 'auto', cross_group_retry: true, ...over }),
          autoSite
        )
      ).toBe(true)
    }
  )

  test.each([
    ['model limits', { model_limits: ['gpt-6.1-sol'] }],
    ['an IP allow-list', { allow_ips: '192.0.2.1' }],
    ['quota queries turned off', { allow_user_quota_query: false }],
  ])('a key with %s does', (_label, over) => {
    expect(keyUsesMoreSettings(saved(over), plainSite)).toBe(true)
  })
})
