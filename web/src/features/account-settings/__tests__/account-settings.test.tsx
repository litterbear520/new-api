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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UserProfile } from '@/features/profile/types'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { AccountSettings } from '..'
import type { SettingsSection } from '../constants'

const profile: UserProfile = {
  id: 7,
  username: 'alice',
  display_name: 'Alice',
  role: 1,
  group: 'default',
  quota: 1000000,
  used_quota: 500000,
  request_count: 42,
  status: 1,
  aff_count: 0,
  aff_quota: 0,
  aff_history_quota: 0,
  created_time: 1_790_000_000,
  has_password: true,
  setting: JSON.stringify({
    notify_type: 'email',
    quota_warning_threshold: 500000,
  }),
}

let passkeyStatus: Record<string, unknown>
let subscriptions: Array<Record<string, unknown>>

beforeEach(() => {
  passkeyStatus = { enabled: false }
  subscriptions = []
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  useAuthStore
    .getState()
    .auth.setUser({ ...profile, permissions: { sidebar_settings: false } })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/user/access_tokens') {
      return { data: { success: true, data: { items: [], legacy: null } } }
    }
    if (url === '/api/user/access_tokens/catalog') {
      return {
        data: {
          success: true,
          data: { groups: [], max_tokens: 20, default_expiry_days: 30 },
        },
      }
    }
    if (url === '/api/user/self') {
      return { data: { success: true, data: profile } }
    }
    if (url === '/api/user/passkey') {
      return { data: { success: true, data: passkeyStatus } }
    }
    if (url === '/api/user/2fa/status') {
      return {
        data: {
          success: true,
          data: { enabled: false, locked: false, backup_codes_remaining: 0 },
        },
      }
    }
    if (url === '/api/user/sessions') {
      return { data: { success: true, data: [] } }
    }
    if (url === '/api/subscription/self') {
      return {
        data: {
          success: true,
          data: {
            subscriptions: [],
            all_subscriptions: subscriptions.map((item) => ({
              subscription: item,
            })),
          },
        },
      }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
  vi.spyOn(api, 'delete').mockResolvedValue({ data: { success: true } })
})

afterEach(async () => {
  await i18next.changeLanguage('en')
  cleanup()
  vi.unstubAllGlobals()
  useAuthStore.getState().auth.reset()
  vi.restoreAllMocks()
})

/** Sidebar switches the user turned off on the 账户资料 page */
function hideModules(modules: Record<string, Record<string, boolean>>) {
  useAuthStore.getState().auth.setUser({
    ...profile,
    permissions: { sidebar_settings: true },
    sidebar_modules: JSON.stringify(modules),
  })
}

async function renderSettings(section?: SettingsSection) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], {
    checkin_enabled: false,
    wechat_login: true,
    github_oauth: true,
    oidc_enabled: true,
    custom_oauth_providers: [
      {
        id: 1,
        name: 'Gitea',
        slug: 'gitea',
        client_id: 'test-client',
        authorization_endpoint: 'https://example.com/oauth/authorize',
        scopes: 'openid',
      },
    ],
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <AccountSettings section={section} />,
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('account settings', () => {
  it('lists the sections and opens on the account details', async () => {
    await renderSettings()
    const nav = screen.getByRole('navigation', { name: 'Account settings' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual([
      'Account details',
      'Sign-in & security',
      'Notifications',
      'Audit Logs',
    ])
    expect(
      within(nav).getByRole('link', { name: 'Account details' })
    ).toHaveAttribute('aria-current', 'page')
    const account = await screen.findByRole('region', {
      name: 'Account details',
    })
    expect(within(account).getByText('alice')).toBeVisible()
    expect(within(account).getByText('Not bound')).toBeVisible()
    expect(within(account).getByText('Requests: 42')).toBeVisible()
    expect(
      within(account).getByRole('button', { name: 'Wallet' })
    ).toHaveAttribute('href', '/wallet')
    expect(
      screen.getByRole('region', { name: 'Preferences' })
    ).toHaveTextContent('Interface Language')
    // security controls load only in their own section
    expect(api.get).not.toHaveBeenCalledWith('/api/user/passkey')
    expect(api.get).not.toHaveBeenCalledWith('/api/user/sessions')
  })

  it('puts sign-in, bindings, devices, tokens, privacy and deletion under security', async () => {
    await renderSettings('security')
    const signIn = await screen.findByRole('region', { name: 'Sign-in' })
    expect(within(signIn).getByText('Password set')).toBeVisible()
    expect(
      within(signIn).getByRole('button', { name: 'Change Password' })
    ).toBeVisible()
    expect(
      await within(signIn).findByRole('button', { name: 'Enable Passkey' })
    ).toBeInTheDocument()
    expect(
      await within(signIn).findByRole('button', { name: 'Enable' })
    ).toBeVisible()

    const bindings = screen.getByRole('list', { name: 'Account Bindings' })
    expect(within(bindings).getAllByRole('listitem')).toHaveLength(5)
    expect(bindings).toHaveClass('divide-y')
    expect(within(bindings).getByText('Gitea')).toBeVisible()

    expect(await screen.findByText('No active login sessions')).toBeVisible()
    expect(screen.getByText('Access tokens')).toBeVisible()
    expect(
      screen.getByRole('switch', { name: 'Record IP Address' })
    ).toBeVisible()
    expect(
      within(screen.getByRole('region', { name: 'Account Actions' })).getByRole(
        'button',
        { name: 'Delete Account' }
      )
    ).toBeVisible()
  })

  it('the password row opens the existing dialog and Escape closes it', async () => {
    const user = userEvent.setup()
    await renderSettings('security')
    await user.click(
      await screen.findByRole('button', { name: 'Change Password' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Change Password',
    })
    expect(within(dialog).getByLabelText('Current Password')).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })

  it('saves IP recording as soon as the switch moves', async () => {
    const user = userEvent.setup()
    await renderSettings('security')
    await user.click(
      await screen.findByRole('switch', { name: 'Record IP Address' })
    )
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        '/api/user/setting',
        expect.objectContaining({ record_ip_log: true })
      )
    )
  })

  it('shows the notification form in its own section', async () => {
    await renderSettings('notifications')
    const section = await screen.findByRole('region', {
      name: 'Notifications',
    })
    expect(
      within(section).getByRole('button', { name: 'Save Settings' })
    ).toBeVisible()
  })

  it('a failed profile load offers retry before showing the rows', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { success: false } })
    const user = userEvent.setup()
    await renderSettings('security')
    expect(await screen.findByText('Failed to load profile')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Delete Account' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByRole('button', { name: 'Delete Account' })
    ).toBeVisible()
  })

  it('keeps sign-in & security reachable when its sidebar module is off', async () => {
    hideModules({ personal: { enabled: true, security: false } })
    await renderSettings('security')
    const nav = screen.getByRole('navigation', { name: 'Account settings' })
    expect(
      within(nav).getByRole('link', { name: 'Sign-in & security' })
    ).toHaveAttribute('aria-current', 'page')
    expect(
      await screen.findByRole('button', { name: 'Change Password' })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Delete Account' })).toBeVisible()
  })

  it('leaves the audit log out when its sidebar module is off', async () => {
    hideModules({ console: { enabled: true, audit: false } })
    await renderSettings('audit')
    const nav = screen.getByRole('navigation', { name: 'Account settings' })
    expect(
      within(nav).queryByRole('link', { name: 'Audit Logs' })
    ).not.toBeInTheDocument()
    expect(
      within(nav).getByRole('link', { name: 'Account details' })
    ).toHaveAttribute('aria-current', 'page')
  })

  it('counts credit with an expiry date in the balance, like the overview', async () => {
    const now = Math.floor(Date.now() / 1000)
    subscriptions = [
      {
        id: 1,
        user_id: 7,
        plan_id: 3,
        status: 'active',
        source: 'order',
        start_time: now - 86400,
        end_time: now + 30 * 86400,
        amount_total: 25_000_000,
        amount_used: 0,
      },
    ]
    await renderSettings()
    const row = (await screen.findByText('Balance')).parentElement
      ?.parentElement as HTMLElement
    await waitFor(() =>
      expect(row).toHaveTextContent(/\$52\s*Includes \$50 with an expiry date/)
    )
  })

  it('shows the balance alone when there is no credit with an expiry date', async () => {
    await renderSettings()
    expect(await screen.findByText('$2')).toBeInTheDocument()
    expect(screen.queryByText(/with an expiry date/)).not.toBeInTheDocument()
  })

  it('copies the user ID with one click', async () => {
    const user = userEvent.setup()
    await renderSettings()
    await user.click(
      await screen.findByRole('button', { name: 'Copy User ID' })
    )
    expect(await navigator.clipboard.readText()).toBe('7')
  })

  it('formats the request count in the interface language', async () => {
    await i18next.changeLanguage('fr')
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/user/self') {
        return {
          data: { success: true, data: { ...profile, request_count: 12345 } },
        }
      }
      throw new Error(`Unexpected GET ${url}`)
    })
    await renderSettings()
    expect(await screen.findByText(/^Requests: 12\s345$/)).toBeVisible()
  })

  it('says why a passkey cannot be added on this device', async () => {
    await renderSettings('security')
    const signIn = await screen.findByRole('region', { name: 'Sign-in' })
    expect(
      await within(signIn).findByText('Passkey not supported on this device')
    ).toBeVisible()
    expect(
      within(signIn).getByText(
        'Use a compatible browser or device with biometric authentication or a security key to register a Passkey.'
      )
    ).toBeVisible()
  })

  it('shows whether the passkey is backed up', async () => {
    passkeyStatus = {
      enabled: true,
      backup_eligible: true,
      backup_state: false,
    }
    await renderSettings('security')
    const signIn = await screen.findByRole('region', { name: 'Sign-in' })
    expect(await within(signIn).findByText('Not backed up')).toBeVisible()
  })

  it('asks to confirm before removing the passkey, then asks to verify', async () => {
    passkeyStatus = { enabled: true }
    const user = userEvent.setup()
    await renderSettings('security')
    await user.click(
      await screen.findByRole('button', { name: 'Remove Passkey' })
    )
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Remove Passkey?',
    })
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }))
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/api/verify/methods',
        expect.objectContaining({ params: { scope: 'passkey.delete' } })
      )
    )
    expect(api.delete).not.toHaveBeenCalled()
  })
})
