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
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { CommonLogsFilterBar } from '../common-logs-filter-bar'
import { UsageLogsProvider } from '../usage-logs-provider'

const OWN_KEYS = ['Claude Code', 'Cherry Studio']

function FilterFixture() {
  const table = useReactTable({
    data: [],
    columns: [],
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <UsageLogsProvider>
      <CommonLogsFilterBar table={table} />
    </UsageLogsProvider>
  )
}

function renderFilter(
  searchResults: Record<string, string[]> = {},
  initialEntry = '/usage-logs/common'
) {
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url.startsWith('/api/token/search?')) {
      const keyword = new URLSearchParams(url.split('?')[1]).get('keyword')
      const names = searchResults[keyword ?? ''] ?? []
      return {
        data: {
          success: true,
          data: { items: names.map((name) => ({ name })), total: names.length },
        },
      }
    }
    if (url.startsWith('/api/token/')) {
      return {
        data: {
          success: true,
          data: { items: OWN_KEYS.map((name) => ({ name })), total: 2 },
        },
      }
    }
    return { data: { success: true, data: { quota: 0, rpm: 0, tpm: 0 } } }
  })
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const logs = createRoute({
    getParentRoute: () => auth,
    path: '/usage-logs/$section',
    component: FilterFixture,
    validateSearch: (search: Record<string, unknown>) => search,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([logs])]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { router, get }
}

async function openKeyFilter() {
  await userEvent.click(await screen.findByLabelText(/^API Key: /))
  return screen.findByRole('combobox', { name: 'API Key' })
}

afterEach(() => {
  vi.restoreAllMocks()
})

it('filters by a key name typed into the list, such as another user’s key', async () => {
  const user = userEvent.setup()
  const { router } = renderFilter()
  const input = await openKeyFilter()

  await user.type(input, 'someone-elses-key')
  await user.click(
    await screen.findByRole('option', { name: /someone-elses-key/ })
  )

  await waitFor(() =>
    expect(router.state.location.search).toEqual(
      expect.objectContaining({ token: 'someone-elses-key', page: 1 })
    )
  )
  expect(
    await screen.findByLabelText('API Key: someone-elses-key')
  ).toHaveTextContent('someone-elses-key')
})

it('applies the typed name with Enter', async () => {
  const user = userEvent.setup()
  const { router } = renderFilter()
  const input = await openKeyFilter()

  await user.type(input, 'typed-key{Enter}')

  await waitFor(() =>
    expect(router.state.location.search).toEqual(
      expect.objectContaining({ token: 'typed-key' })
    )
  )
})

it('does not apply while an IME is still composing the name', async () => {
  const { router } = renderFilter()
  const input = await openKeyFilter()

  fireEvent.change(input, { target: { value: 'mi' } })
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })

  expect(router.state.location.search).not.toHaveProperty('token')
  expect(screen.getByRole('combobox', { name: 'API Key' })).toBeVisible()
})

it('finds the user’s own keys beyond the first page on the server', async () => {
  const user = userEvent.setup()
  const { get } = renderFilter({ '%prod%': ['production-backend-key'] })
  const input = await openKeyFilter()

  await user.type(input, 'prod')

  expect(
    await screen.findByRole('option', { name: 'production-backend-key' })
  ).toBeVisible()
  expect(get).toHaveBeenCalledWith(
    expect.stringContaining('/api/token/search?keyword=%25prod%25')
  )
})

it('lists the own keys and clears the filter with All keys', async () => {
  const user = userEvent.setup()
  const { router } = renderFilter({}, '/usage-logs/common?token=Claude+Code')
  await openKeyFilter()

  expect(
    await screen.findByRole('option', { name: 'Cherry Studio' })
  ).toBeVisible()
  await user.click(screen.getByRole('option', { name: 'All keys' }))

  await waitFor(() =>
    expect(router.state.location.search).not.toHaveProperty('token')
  )
})

it('names the chosen key on the trigger and marks it selected in the list', async () => {
  renderFilter({}, '/usage-logs/common?token=Claude+Code')

  expect(await screen.findByLabelText('API Key: Claude Code')).toBeVisible()
  await openKeyFilter()
  expect(
    await screen.findByRole('option', { name: 'Claude Code' })
  ).toHaveAttribute('aria-selected', 'true')
})
