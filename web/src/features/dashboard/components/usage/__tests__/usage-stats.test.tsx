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
import { useSystemConfigStore } from '@/stores/system-config-store'

import { UsageStats } from '../usage-stats'

const DAY = 86400
let client: QueryClient
let usageRows: Array<Record<string, unknown>>
let usageFails: boolean
/** Replaces the answer of the given path when set */
let failure: { path: string; reply: () => Promise<unknown> } | null

const ok = (data: unknown) => ({ data: { success: true, data } })
const now = () => Math.floor(Date.now() / 1000)

beforeEach(() => {
  localStorage.clear()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  usageFails = false
  failure = null
  usageRows = [
    {
      model_name: 'gpt-6.1-sol',
      created_at: now() - 3600,
      quota: 500000,
      count: 4,
      token_used: 1200,
    },
  ]
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (failure && url === failure.path) return failure.reply()
    if (url === '/api/data/self') {
      if (usageFails) throw new Error('offline')
      return ok(usageRows)
    }
    if (url === '/api/data/flow/self') return ok([])
    if (url.startsWith('/api/token/')) return ok({ items: [], total: 0 })
    throw new Error(`Unexpected usage request: ${url}`)
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  localStorage.clear()
})

async function renderStats() {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <UsageStats isAdmin={false} />,
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

/** The time ranges /api/data/self was asked for, in seconds */
function usageRanges(): number[] {
  return vi
    .mocked(api.get)
    .mock.calls.filter(([url]) => url === '/api/data/self')
    .map(([, config]) => {
      const params = (config as { params: Record<string, number> }).params
      return params.end_timestamp - params.start_timestamp
    })
}

describe('usage statistics', () => {
  it('the figures switch the metric, and the chosen one is pressed', async () => {
    const user = userEvent.setup()
    await renderStats()
    const spend = await screen.findByRole('button', { name: /^Spend/ })
    const requests = screen.getByRole('button', { name: /^Requests/ })
    expect(spend).toHaveAttribute('aria-pressed', 'true')
    expect(requests).toHaveAttribute('aria-pressed', 'false')

    await user.click(requests)
    expect(requests).toHaveAttribute('aria-pressed', 'true')
    expect(spend).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByText('Sorted by Requests. Click a row to see its logs.')
    ).toBeInTheDocument()
  })

  it('with no usage, says so and offers the last 30 days', async () => {
    const user = userEvent.setup()
    usageRows = []
    await renderStats()
    expect(
      (await screen.findAllByText('No usage in this range')).length
    ).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Show last 30 days' }))
    await waitFor(() =>
      expect(Math.max(...usageRanges())).toBeGreaterThanOrEqual(29 * DAY)
    )
  })

  it('a failed load shows an error that retries', async () => {
    const user = userEvent.setup()
    usageFails = true
    await renderStats()
    expect(await screen.findByText('Failed to load')).toBeInTheDocument()

    usageFails = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() =>
      expect(screen.queryByText('Failed to load')).not.toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /^Requests/ })).toHaveTextContent(
      '4'
    )
  })

  it('usage answered with success false shows the reason and no zero figures', async () => {
    failure = {
      path: '/api/data/self',
      reply: async () => ({
        data: {
          success: false,
          message: 'The time range cannot exceed 7 days',
        },
      }),
    }
    await renderStats()

    expect(
      await screen.findByText('The time range cannot exceed 7 days')
    ).toBeInTheDocument()
    for (const name of [/^Spend/, /^Requests/, /^Tokens/]) {
      const figure = screen.getByRole('button', { name })
      expect(figure).toHaveTextContent('—')
      expect(figure).not.toHaveTextContent(/\d/)
    }
  })

  it('a key table that fails with 502 shows an error with retry instead of no usage', async () => {
    const user = userEvent.setup()
    failure = {
      path: '/api/data/flow/self',
      reply: async () => {
        throw Object.assign(new Error('Request failed with status code 502'), {
          isAxiosError: true,
          response: { status: 502, data: '' },
        })
      },
    }
    await renderStats()

    const table = (
      await screen.findByRole('group', { name: 'Group by' })
    ).closest('section') as HTMLElement
    expect(await within(table).findByText('Failed to load')).toBeInTheDocument()
    expect(
      within(table).queryByText('No usage in this range')
    ).not.toBeInTheDocument()

    failure = null
    await user.click(within(table).getByRole('button', { name: 'Retry' }))
    await waitFor(() =>
      expect(
        within(table).queryByText('Failed to load')
      ).not.toBeInTheDocument()
    )
  })
})
