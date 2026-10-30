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
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { CommonLogsFilterBar } from '../common-logs-filter-bar'
import { LogsSearchInput } from '../logs-toolbar-parts'
import { UsageLogsProvider } from '../usage-logs-provider'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('logs search box with an IME', () => {
  function renderSearch() {
    const onApply = vi.fn()
    render(
      <LogsSearchInput
        value=''
        onApply={onApply}
        placeholder='Search models...'
        label='Model Name'
      />
    )
    const input = screen.getByRole('searchbox', { name: 'Model Name' })
    return { input, onApply }
  }

  it('searches the composed text only after the IME finishes', () => {
    vi.useFakeTimers()
    const { input, onApply } = renderSearch()

    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'qian' } })
    vi.advanceTimersByTime(1000)
    expect(onApply).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '千问' } })
    fireEvent.compositionEnd(input, { data: '千问' })
    vi.advanceTimersByTime(400)
    expect(onApply).toHaveBeenCalledExactlyOnceWith('千问')
  })

  it('ignores the Enter that picks a candidate while composing (Chrome)', () => {
    const { input, onApply } = renderSearch()

    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'deepseek' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })

    expect(onApply).not.toHaveBeenCalled()
  })

  it('ignores the Enter that Safari sends after the IME ends (keyCode 229)', () => {
    vi.useFakeTimers()
    const { input, onApply } = renderSearch()

    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '深度' } })
    fireEvent.compositionEnd(input, { data: '深度' })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    expect(onApply).not.toHaveBeenCalled()

    // The composed text is still searched after the usual pause.
    vi.advanceTimersByTime(400)
    expect(onApply).toHaveBeenCalledExactlyOnceWith('深度')
  })
})

describe('more filters with an IME', () => {
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

  async function renderMoreFilters() {
    vi.spyOn(api, 'get').mockImplementation(async (url) => ({
      data: {
        success: true,
        data:
          url === '/api/user/self/groups' ? {} : { quota: 0, rpm: 0, tpm: 0 },
      },
    }))
    const root = createRootRoute()
    const auth = createRoute({
      getParentRoute: () => root,
      id: '_authenticated',
    })
    const logs = createRoute({
      getParentRoute: () => auth,
      path: '/usage-logs/$section',
      component: FilterFixture,
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
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    await userEvent.click(
      await screen.findByRole('button', { name: /More filters/ })
    )
    const input = await screen.findByRole('textbox', { name: 'Request ID' })
    return { router, input }
  }

  it.each([
    { browser: 'Chrome', keyInit: { isComposing: true } },
    { browser: 'Safari', keyInit: { keyCode: 229 } },
  ])(
    'keeps the panel open and unapplied on a candidate Enter ($browser)',
    async (props) => {
      const { router, input } = await renderMoreFilters()

      fireEvent.compositionStart(input)
      fireEvent.change(input, { target: { value: '请求' } })
      fireEvent.keyDown(input, { key: 'Enter', ...props.keyInit })

      expect(router.state.location.search).not.toHaveProperty('requestId')
      expect(screen.getByRole('textbox', { name: 'Request ID' })).toBeVisible()
    }
  )

  it('applies the fields on a plain Enter after the IME ends', async () => {
    const { router, input } = await renderMoreFilters()

    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'req-请求' } })
    fireEvent.compositionEnd(input, { data: '请求' })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        requestId: 'req-请求',
        page: 1,
      })
    )
  })
})
