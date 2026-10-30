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

import { BearOverview } from '..'

const DOLLAR = 500000
const hour = 3600
let client: QueryClient
let self: AuthUser
let usageRows: Array<Record<string, unknown>>
/** What /api/data/self answers; a rejection stands for a 5xx */
let usageReply: () => Promise<unknown>
let maxRangeDays: number | undefined

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

/** Steady spend of `perDay` dollars spread over the last 10 days */
function steadyUsage(perDay: number) {
  const rows = []
  for (let h = 1; h <= 240; h++) {
    rows.push({
      model_name: 'gpt-6.1-sol',
      created_at: Math.floor((nowSec() - h * hour) / hour) * hour,
      quota: (perDay * DOLLAR) / 24,
      token_used: 1000,
      count: 1,
    })
  }
  return rows
}

function key(over: Record<string, unknown>) {
  return {
    id: 1,
    name: 'key',
    key: 'abcd****wxyz',
    status: 1,
    remain_quota: 0,
    used_quota: 0,
    unlimited_quota: true,
    expired_time: -1,
    created_time: nowSec() - 86400,
    accessed_time: nowSec() - hour,
    model_limits_enabled: false,
    ...over,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  usageRows = []
  usageReply = async () => ({ data: { success: true, data: usageRows } })
  maxRangeDays = undefined
  // Line latency probes go to the network; keep tests offline.
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/api/user/self') return { data: { success: true, data: self } }
    if (url === '/api/status') {
      return {
        data: {
          success: true,
          data: {
            api_info_enabled: false,
            price: 0.1,
            quota_remind_enabled: true,
            log_max_range_days: maxRangeDays,
          },
        },
      }
    }
    if (url === '/api/subscription/self') {
      return { data: { success: true, data: { all_subscriptions: [] } } }
    }
    if (url === '/api/data/self') return usageReply()
    if (url === '/api/data/flow/self') {
      return {
        data: { success: true, data: [{ token_id: 2, quota: 9 * DOLLAR }] },
      }
    }
    if (url === '/api/token/?p=1&size=100') {
      return {
        data: {
          success: true,
          data: {
            items: [
              key({
                id: 1,
                name: 'Cherry Studio',
                unlimited_quota: false,
                remain_quota: 10 * DOLLAR,
                used_quota: 10 * DOLLAR,
              }),
              key({ id: 2, name: 'Claude Code' }),
            ],
          },
        },
      }
    }
    // What the create key dialog reads
    if (url === '/api/user/models') {
      return { data: { success: true, data: [] } }
    }
    if (url === '/api/user/self/groups') {
      return {
        data: {
          success: true,
          data: { default: { desc: 'Standard access', ratio: 1 } },
        },
      }
    }
    if (url === '/api/token/auto-groups') {
      return { data: { success: true, data: { groups: [], max_count: 5 } } }
    }
    if (url.startsWith('/api/log/self/stat?')) {
      return { data: { success: true, data: { quota: 2 * DOLLAR } } }
    }
    if (url.startsWith('/api/log/self?')) {
      const type = new URLSearchParams(url.split('?')[1]).get('type')
      const items =
        type === '1'
          ? [{ id: 1, created_at: nowSec() - 3 * 86400, type: 1 }]
          : []
      return { data: { success: true, data: { items } } }
    }
    throw new Error(`Unexpected overview request: ${url}`)
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  window.localStorage.clear()
})

async function renderOverview(user: AuthUser) {
  self = user
  useAuthStore.getState().auth.setUser(user)
  const router = createRouter({
    routeTree: createRootRoute({ component: BearOverview }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const NEW_USER: AuthUser = {
  id: 1,
  username: 'bear',
  role: 1,
  email: 'bear@example.com',
  quota: 5 * DOLLAR,
  used_quota: 0,
  request_count: 0,
}

/** How often the overview has read the key list */
function tokenListReads() {
  return vi
    .mocked(api.get)
    .mock.calls.filter(([url]) => url === '/api/token/?p=1&size=100').length
}

describe('overview states', () => {
  it('shows a new account zero stats and the first steps instead of the usage chart', async () => {
    await renderOverview(NEW_USER)

    expect(
      await screen.findByRole('heading', { name: 'No usage yet' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Your $5 free credit is here.', { exact: false })
    ).toBeInTheDocument()
    // The stat cards show zeros instead of waiting for usage that never comes
    expect(
      screen.getByRole('heading', { name: 'Requests, last 7 days' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Usage' })
    ).not.toBeInTheDocument()
  })

  it('creates the first API key in a dialog on the page and then reloads the keys', async () => {
    await renderOverview(NEW_USER)
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { success: true, data: {} } })
    const empty = await screen.findByRole('region', { name: 'No usage yet' })
    await waitFor(() => expect(tokenListReads()).toBe(1))

    await userEvent.click(
      within(empty).getByRole('button', { name: 'Create API Key' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Create API Key',
    })
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Create' })
      ).toBeEnabled()
    )
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Claude Code')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Create' })
    )

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/api/token/',
        expect.objectContaining({ name: 'Claude Code' })
      )
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Create API Key' })
      ).not.toBeInTheDocument()
    )
    await waitFor(() => expect(tokenListReads()).toBe(2))
  })

  it('opens the connection details from the empty usage card, next to its own button', async () => {
    await renderOverview(NEW_USER)
    const empty = await screen.findByRole('region', { name: 'No usage yet' })
    const [headerTrigger] = screen.getAllByRole('button', {
      name: /Connection details/,
    })
    const cardTrigger = within(empty).getByRole('button', {
      name: 'Connection details',
    })

    await userEvent.click(cardTrigger)

    const popover = await screen.findByRole('dialog')
    expect(within(popover).getByText('API address')).toBeInTheDocument()
    // The page's text and focus rules reach the portalled panel through this class
    expect(popover).toHaveClass('bo-pop')
    expect(cardTrigger).toHaveAttribute('aria-expanded', 'true')
    expect(headerTrigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('warns in the header when the balance lasts under three days', async () => {
    usageRows = steadyUsage(1)
    await renderOverview({
      id: 1,
      username: 'bear',
      role: 1,
      email: 'bear@example.com',
      quota: DOLLAR / 2,
      used_quota: 40 * DOLLAR,
      request_count: 500,
    })

    expect(
      await screen.findByText(/At your 7-day pace, it runs out in/)
    ).toBeInTheDocument()
    // Buttons rendered as links keep the button role (Base UI)
    expect(screen.getByRole('button', { name: 'Top up' })).toHaveAttribute(
      'href',
      '/wallet?tab=topup'
    )
    expect(
      screen.getByRole('button', { name: /Connection details/ })
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows an active account its spend, usage and key limits', async () => {
    usageRows = steadyUsage(2)
    await renderOverview({
      id: 1,
      username: 'bear',
      display_name: 'Bear',
      role: 1,
      email: 'bear@example.com',
      quota: 30 * DOLLAR,
      used_quota: 100 * DOLLAR,
      request_count: 900,
    })

    expect(
      await screen.findByRole('heading', { name: "Today's spend" })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Usage' })).toBeInTheDocument()
    // The logs link starts where the 7-day chart starts: midnight 6 days ago
    const logs = new URL(
      screen.getByRole('link', { name: 'View logs' }).getAttribute('href') ??
        '',
      'http://x'
    )
    expect(logs.pathname).toBe('/usage-logs/common')
    const since = new Date(Number(logs.searchParams.get('startTime')))
    const sixDaysAgo = new Date()
    sixDaysAgo.setHours(0, 0, 0, 0)
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)
    expect(since.getTime()).toBe(sixDaysAgo.getTime())
    expect(await screen.findByText('50% used')).toBeInTheDocument()
    expect(screen.getByText('$9 in the last 30 days')).toBeInTheDocument()
    // No cache card and no model cards, so no log sample and no price list
    expect(
      screen.queryByRole('heading', { name: 'Cache hit rate' })
    ).not.toBeInTheDocument()
    const urls = vi.mocked(api.get).mock.calls.map(([url]) => url)
    expect(urls).not.toContain('/api/pricing')
    const logTypes = urls
      .filter((url) => url.startsWith('/api/log/self?'))
      .map((url) => new URLSearchParams(url.split('?')[1]).get('type'))
    expect(logTypes).not.toContain('2')
    // Connection details moved into a header popover
    expect(
      screen.getByRole('button', { name: /Connection details/ })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('heading', { name: 'Connection details' })
    ).not.toBeInTheDocument()
  })
})

const ACTIVE_USER: AuthUser = {
  id: 1,
  username: 'bear',
  role: 1,
  email: 'bear@example.com',
  quota: 30 * DOLLAR,
  used_quota: 100 * DOLLAR,
  request_count: 900,
}

/** The time range of every /api/data/self read */
function usageReads() {
  return vi
    .mocked(api.get)
    .mock.calls.filter(([url]) => url === '/api/data/self')
    .map(([, config]) => {
      const params = (config as { params: Record<string, number> }).params
      return { start: params.start_timestamp, end: params.end_timestamp }
    })
}

describe('overview usage failure', () => {
  it('a usage answer with success false shows the server reason and a retry, and keeps the balance', async () => {
    usageReply = async () => ({
      data: { success: false, message: 'Usage store is busy' },
    })
    await renderOverview(ACTIVE_USER)

    expect(await screen.findByText('Failed to load usage')).toBeInTheDocument()
    expect(screen.getByText('Usage store is busy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    // The wallet card does not claim there was no spend
    expect(
      screen.queryByText('No spend in the last 7 days')
    ).not.toBeInTheDocument()
    expect(screen.getByText('Spending pace unavailable')).toBeInTheDocument()
    // No skeleton waits forever
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('a failed usage request recovers through Retry', async () => {
    usageReply = async () => {
      throw Object.assign(new Error('Request failed with status code 502'), {
        isAxiosError: true,
        response: { status: 502, data: '' },
      })
    }
    await renderOverview(ACTIVE_USER)
    const retry = await screen.findByRole('button', { name: 'Retry' })

    usageRows = steadyUsage(2)
    usageReply = async () => ({ data: { success: true, data: usageRows } })
    await userEvent.click(retry)

    expect(
      await screen.findByRole('heading', { name: "Today's spend" })
    ).toBeInTheDocument()
    expect(screen.queryByText('Failed to load usage')).not.toBeInTheDocument()
  })

  it('a log range limit under the usage window keeps the request inside it', async () => {
    maxRangeDays = 7
    await renderOverview(ACTIVE_USER)

    await waitFor(() => expect(usageReads().length).toBeGreaterThan(0))
    // Every read, the first one included, stays inside the limit
    for (const read of usageReads()) {
      expect(read.end - read.start).toBeLessThanOrEqual(7 * 86400)
    }
  })
})
