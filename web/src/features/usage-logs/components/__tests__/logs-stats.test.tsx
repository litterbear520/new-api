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
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { CommonLogsStats } from '../common-logs-stats'
import { UsageLogsProvider } from '../usage-logs-provider'

function renderStats(total: number) {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: { quota: 0, rpm: 0, tpm: 0 } },
  })
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const logs = createRoute({
    getParentRoute: () => auth,
    path: '/usage-logs/$section',
    component: () => <CommonLogsStats total={total} />,
    validateSearch: (search: Record<string, unknown>) => search,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([logs])]),
    history: createMemoryHistory({ initialEntries: ['/usage-logs/common'] }),
  })
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <UsageLogsProvider>
        <RouterProvider router={router} />
      </UsageLogsProvider>
    </QueryClientProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

it.each([0, 1, 25])(
  'counts %s matching logs with wording that fits any number',
  async (total) => {
    renderStats(total)

    expect(
      await screen.findByText(new RegExp(`Records: ${total}(?!\\d)`))
    ).toBeVisible()
  }
)

it('groups the digits of a large record count', async () => {
  renderStats(12345)

  expect(await screen.findByText(/Records: 12,345/)).toBeVisible()
})

it('lets the totals wrap on phones instead of cutting off RPM and TPM', async () => {
  renderStats(158)

  const line = await screen.findByText(/Records: 158/)
  const summary = line.closest('p')
  // Below sm the line wraps between parts; from sm up it stays one line.
  expect(summary).not.toHaveClass('truncate')
  expect(summary).toHaveClass('sm:truncate')
  expect(line).toHaveClass('whitespace-nowrap')
})
