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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { BearInvite } from '..'
import { INVITER_LOG_KEY } from '../lib/records'

const DOLLAR = 500000
let client: QueryClient
let self: AuthUser
let logs: Array<Record<string, unknown>>
let rules: Record<string, unknown>
let logsFail: boolean
let compliance: boolean | 'loading' | 'offline'

const ok = (data: unknown) => ({ data: { success: true, data } })

beforeEach(() => {
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  logs = []
  logsFail = false
  compliance = true
  rules = { tiers: [], invite: { inviter: 5, invitee: 5 } }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (String(input) === '/pay/rules') {
      return new Response(JSON.stringify(rules), { status: 200 })
    }
    throw new Error('offline')
  })
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/api/user/self') return ok(self)
    if (url === '/api/user/aff') return ok('Kx3m')
    if (url === '/api/user/topup/info') {
      if (compliance === 'loading') return new Promise(() => undefined)
      if (compliance === 'offline') throw new Error('offline')
      return ok({ payment_compliance_confirmed: compliance })
    }
    if (url.startsWith('/api/log/self?')) {
      expect(url).toContain('type=4')
      if (logsFail) throw new Error('offline')
      return ok({ items: logs, total: logs.length, page: 1, page_size: 100 })
    }
    throw new Error(`Unexpected invite request: ${url}`)
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
})

async function renderInvite(user: AuthUser) {
  self = user
  useAuthStore.getState().auth.setUser(user)
  const router = createRouter({
    routeTree: createRootRoute({ component: BearInvite }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const bear: AuthUser = {
  id: 7,
  username: 'bear',
  role: 1,
  quota: 10 * DOLLAR,
  aff_quota: 5 * DOLLAR,
  aff_history_quota: 10 * DOLLAR,
  aff_count: 2,
}

describe('invite page', () => {
  it('shows the rewards, the link, what waits and each friend', async () => {
    logs = [
      {
        id: 3,
        type: 4,
        created_at: 1_790_000_000,
        content: 'Bonus for inviting a user ＄5.000000',
        other: JSON.stringify({
          content_parts: [
            { key: INVITER_LOG_KEY, params: { quota: '＄5.000000' } },
          ],
        }),
      },
      {
        id: 4,
        type: 4,
        created_at: 1_790_000_100,
        content: 'something else',
        other: '',
      },
    ]
    await renderInvite(bear)

    expect(
      await screen.findByText(
        'When a friend signs up with your link, you get $5 and they get $5 extra.'
      )
    ).toBeInTheDocument()
    expect(
      await screen.findByDisplayValue(/\/sign-up\?aff=Kx3m$|aff=Kx3m/)
    ).toBeInTheDocument()
    const summary = screen.getByRole('region', { name: 'Your invite link' })
    expect(within(summary).getByText('$5')).toBeInTheDocument()
    expect(within(summary).getByText('$10')).toBeInTheDocument()
    expect(
      within(summary).getByText('Friends invited').nextElementSibling
    ).toHaveTextContent('2')
    expect(
      within(summary).getByRole('button', { name: 'Move to balance' })
    ).toBeEnabled()

    const history = screen.getByRole('region', { name: 'Reward history' })
    expect(await within(history).findByText('+$5')).toBeInTheDocument()
    expect(within(history).getAllByText('A friend signed up')).toHaveLength(1)
  })

  it('keeps rewards from moving until the compliance terms are confirmed', async () => {
    compliance = false
    await renderInvite(bear)
    const summary = screen.getByRole('region', { name: 'Your invite link' })
    expect(
      await within(summary).findByText(
        'Referral reward transfer is disabled until the administrator confirms compliance terms.'
      )
    ).toBeInTheDocument()
    expect(
      within(summary).getByRole('button', { name: 'Move to balance' })
    ).toBeDisabled()
  })

  it('waits for the compliance answer before rewards can move', async () => {
    compliance = 'loading'
    await renderInvite(bear)
    const summary = screen.getByRole('region', { name: 'Your invite link' })
    expect(
      await within(summary).findByText(/^Moves from \$1/)
    ).toBeInTheDocument()
    expect(
      within(summary).getByRole('button', { name: 'Move to balance' })
    ).toBeDisabled()
  })

  it('lets rewards move when the compliance answer cannot load', async () => {
    compliance = 'offline'
    await renderInvite(bear)
    const summary = screen.getByRole('region', { name: 'Your invite link' })
    await waitFor(() =>
      expect(
        within(summary).getByRole('button', { name: 'Move to balance' })
      ).toBeEnabled()
    )
  })

  it('says it plainly without amounts, and offers the link when empty', async () => {
    rules = { tiers: [] }
    await renderInvite({
      ...bear,
      aff_quota: 0,
      aff_history_quota: 0,
      aff_count: 0,
    })

    expect(
      await screen.findByText(
        'When a friend signs up with your link, you both get a reward.'
      )
    ).toBeInTheDocument()
    expect(await screen.findByText('No invites yet')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Move to balance' })
    ).toBeDisabled()
    expect(
      await screen.findByRole('button', { name: 'Copy invite link' })
    ).toBeInTheDocument()
  })

  it('offers a retry when the reward history fails to load', async () => {
    const user = userEvent.setup()
    logsFail = true
    logs = [
      {
        id: 3,
        type: 4,
        created_at: 1_790_000_000,
        content: 'Bonus for inviting a user ＄5.000000',
        other: JSON.stringify({
          content_parts: [
            { key: INVITER_LOG_KEY, params: { quota: '＄5.000000' } },
          ],
        }),
      },
    ]
    await renderInvite(bear)

    const history = screen.getByRole('region', { name: 'Reward history' })
    expect(await within(history).findByText('Failed to load')).toBeVisible()
    expect(
      within(history).queryByText('No invites yet')
    ).not.toBeInTheDocument()

    logsFail = false
    await user.click(within(history).getByRole('button', { name: 'Retry' }))
    expect(await within(history).findByText('+$5')).toBeVisible()
  })

  it('copies the invite link from the summary', async () => {
    const user = userEvent.setup()
    await renderInvite(bear)
    const summary = screen.getByRole('region', { name: 'Your invite link' })
    await screen.findByDisplayValue(/aff=Kx3m$/)
    await user.click(within(summary).getByRole('button', { name: 'Copy link' }))
    expect(await navigator.clipboard.readText()).toMatch(/aff=Kx3m$/)
  })
})
