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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checkIsActive } from '@/components/layout/lib/url-utils'
import {
  parseSidebarModulesAdmin,
  serializeSidebarModulesAdmin,
} from '@/features/system-settings/maintenance/config'
import { useAuthStore } from '@/stores/auth-store'

import { useSidebarConfig } from '../use-sidebar-config'
import { useSidebarData } from '../use-sidebar-data'

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useAuthStore.getState().auth.reset()
})

function sidebarFor(admin?: object, user?: object, canConfigure = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], {
    SidebarModulesAdmin: admin ? JSON.stringify(admin) : '',
  })
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'alice',
    role: 1,
    permissions: { sidebar_settings: canConfigure },
    sidebar_modules: user ? JSON.stringify(user) : '',
  })
  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    )
  }
  const result = renderHook(
    () => useSidebarConfig(useSidebarData().navGroups),
    { wrapper: Wrapper }
  )
  return result
}

describe('security sidebar visibility', () => {
  it('old configurations list the account settings sections in their order and keep API Keys', () => {
    const { result } = sidebarFor(
      { personal: { enabled: true, personal: true, topup: true } },
      { personal: { enabled: true, personal: true } }
    )
    expect(
      result.current
        .find((group) => group.id === 'account')
        ?.items.map((item) => item.title)
    ).toEqual([
      'Account settings',
      'Sign-in & security',
      'Notifications',
      'Audit Logs',
    ])
    expect(
      result.current
        .flatMap((group) => group.items)
        .some((item) => item.title === 'API Keys')
    ).toBe(true)
  })
  it.each([
    [{ personal: { enabled: true, personal: false } }, undefined],
    [undefined, { personal: { enabled: true, personal: false } }],
    [undefined, { personal: { enabled: false } }],
  ])(
    'hiding the personal module keeps Account settings searchable (%j, %j)',
    (admin, user) => {
      const { result } = sidebarFor(admin, user)
      expect(
        result.current
          .find((group) => group.id === 'account')
          ?.items.map((item) => item.title)
      ).toContain('Account settings')
    }
  )
  it.each([
    [{ personal: { enabled: true, security: false } }, undefined],
    [{ personal: { enabled: false } }, { personal: { security: true } }],
    [undefined, { personal: { enabled: true, security: false } }],
    [undefined, { personal: { enabled: false } }],
  ])(
    'admin or user disablement hides Sign-in & security (%j, %j)',
    (admin, user) => {
      const { result } = sidebarFor(admin, user)
      expect(
        result.current
          .flatMap((group) => group.items)
          .some((item) => item.title === 'Sign-in & security')
      ).toBe(false)
    }
  )
  it('users without sidebar configuration permission retain the admin view', () => {
    const { result } = sidebarFor(
      undefined,
      { personal: { security: false } },
      false
    )
    expect(
      result.current
        .flatMap((group) => group.items)
        .some((item) => item.title === 'Sign-in & security')
    ).toBe(true)
  })
})

describe('audit log sidebar entry', () => {
  it('admin settings default Audit Logs to visible and preserve its independent toggle when saved', () => {
    const config = parseSidebarModulesAdmin(
      '{"console":{"enabled":true,"log":true}}'
    )
    expect(config.console.audit).toBe(true)
    config.console.audit = false
    const saved = parseSidebarModulesAdmin(serializeSidebarModulesAdmin(config))
    const { result } = sidebarFor(saved)
    const titles = result.current
      .flatMap((group) => group.items)
      .map((item) => item.title)
    expect(titles).not.toContain('Audit Logs')
    expect(titles).toContain('Usage Logs')
  })

  it('legacy configurations keep an Audit Logs entry that opens its account settings section', () => {
    const { result } = sidebarFor(
      { console: { enabled: true, log: true } },
      { console: { enabled: true, log: true } }
    )
    expect(
      result.current.find((group) => group.id === 'account')?.items
    ).toContainEqual(
      expect.objectContaining({
        title: 'Audit Logs',
        url: '/profile',
        search: { section: 'audit' },
      })
    )
  })

  it.each([
    [{ console: { enabled: true, audit: false } }, undefined],
    [{ console: { enabled: false } }, { console: { audit: true } }],
    [undefined, { console: { enabled: true, audit: false } }],
    [undefined, { console: { enabled: false } }],
  ])(
    'admin and personal visibility rules can hide Audit Logs (%j, %j)',
    (admin, user) => {
      const { result } = sidebarFor(admin, user)
      expect(
        result.current
          .flatMap((group) => group.items)
          .some((item) => item.title === 'Audit Logs')
      ).toBe(false)
    }
  )

  it('hiding Usage Logs does not hide the independently configured Audit Logs entry', () => {
    const { result } = sidebarFor({ console: { enabled: true, log: false } })
    const titles = result.current
      .flatMap((group) => group.items)
      .map((item) => item.title)
    expect(titles).not.toContain('Usage Logs')
    expect(titles).toContain('Audit Logs')
  })
})

describe('console sidebar layout', () => {
  it('one Usage Logs entry stays selected on the task and drawing log tabs', () => {
    const { result } = sidebarFor()
    const items = result.current.flatMap((group) => group.items)
    for (const href of [
      '/usage-logs/common',
      '/usage-logs/task',
      '/usage-logs/drawing',
    ]) {
      expect(
        items
          .filter((item) => checkIsActive(href, item))
          .map((item) => item.title)
      ).toEqual(['Usage Logs'])
    }
  })

  it('one Usage statistics entry stays selected on the admin flow and user analytics sections', () => {
    const { result } = sidebarFor()
    const items = result.current.flatMap((group) => group.items)
    for (const href of [
      '/dashboard/models',
      '/dashboard/flow',
      '/dashboard/users',
    ]) {
      expect(
        items
          .filter((item) => checkIsActive(href, item))
          .map((item) => item.title)
      ).toEqual(['Usage statistics'])
    }
  })

  it('account search entries open the account settings sections instead of the old pages', () => {
    const { result } = sidebarFor()
    const account = result.current.find((group) => group.id === 'account')
    expect(
      account?.items.map((item) => ({
        url: item.url,
        search: 'search' in item ? item.search : undefined,
      }))
    ).toEqual([
      { url: '/profile', search: undefined },
      { url: '/profile', search: { section: 'security' } },
      { url: '/profile', search: { section: 'notifications' } },
      { url: '/profile', search: { section: 'audit' } },
    ])
  })

  it('account pages are found by search but not listed in the sidebar', () => {
    const { result } = sidebarFor()
    const account = result.current.find((group) => group.id === 'account')
    expect(account?.searchOnly).toBe(true)
    expect(
      result.current
        .filter((group) => !group.searchOnly)
        .flatMap((group) => group.items)
        .map((item) => item.title)
    ).not.toContain('Account settings')
  })
})
