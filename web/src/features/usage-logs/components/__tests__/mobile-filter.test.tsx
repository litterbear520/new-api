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
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import zhTW from '@/i18n/locales/zh-TW.json'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'

import { formatRangeLabel, presetRange } from '../../lib/time-range'
import { CommonLogsFilterBar } from '../common-logs-filter-bar'
import { CompactDateTimeRangePicker } from '../compact-date-time-range-picker'
import { LogsFilterToolbar } from '../logs-filter-toolbar'
import { UsageLogsProvider } from '../usage-logs-provider'

const captureDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'setPointerCapture'
)
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

function Fixture() {
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
async function renderToolbar(options: { phone?: boolean } = {}) {
  const original = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...original(query),
    matches: Boolean(options.phone) && query === '(max-width: 640px)',
  }))
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: {
      success: true,
      data: url === '/api/user/self/groups' ? {} : { quota: 0, rpm: 0, tpm: 0 },
    },
  }))
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const logs = createRoute({
    getParentRoute: () => auth,
    path: '/usage-logs/$section',
    component: Fixture,
    validateSearch: (search: Record<string, unknown>) => search,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([logs])]),
    history: createMemoryHistory({
      initialEntries: [
        '/usage-logs/common?page=3&type=%5B%222%22%5D&group=default',
      ],
    }),
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
  await screen.findByRole('button', { name: /^Time range/ })
  return router
}
afterEach(async () => {
  if (captureDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'setPointerCapture',
      captureDescriptor
    )
  } else Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture')
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  await i18next.changeLanguage('en')
})

it('names the default range Today and applies a preset at once, keeping the other filters', async () => {
  const router = await renderToolbar()
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: /^Time range/ })
  expect(trigger).toHaveTextContent('Today')
  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: 'Last 7 days' }))
  const week = presetRange('7d')
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      page: 1,
      group: 'default',
      type: ['2'],
      startTime: week.start.getTime(),
      endTime: week.end.getTime(),
    })
  )
  expect(screen.getByRole('button', { name: /^Time range/ })).toHaveTextContent(
    'Last 7 days'
  )
})

it('applies a custom range only after Apply and shows its dates', async () => {
  const router = await renderToolbar({ phone: true })
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /^Time range/ }))
  fireEvent.change(screen.getByLabelText('Start Time'), {
    target: { value: '2026-09-07T09:30' },
  })
  fireEvent.change(screen.getByLabelText('End Time'), {
    target: { value: '2026-09-08T17:45' },
  })
  expect(router.state.location.search).not.toHaveProperty('startTime')
  await user.click(screen.getByRole('button', { name: 'Apply' }))
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      page: 1,
      startTime: new Date('2026-09-07T09:30').getTime(),
      endTime: new Date('2026-09-08T17:45').getTime(),
    })
  )
  expect(screen.getByRole('button', { name: /^Time range/ })).toHaveTextContent(
    formatRangeLabel(new Date('2026-09-07T09:30'), new Date('2026-09-08T17:45'))
  )
})

it('searches models on Enter without waiting for the pause', async () => {
  const router = await renderToolbar()
  const user = userEvent.setup()
  await user.type(
    screen.getByRole('searchbox', { name: 'Model Name' }),
    'gemini-3.7-flash{Enter}'
  )
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      page: 1,
      model: 'gemini-3.7-flash',
    })
  )
})

it('keeps the quick actions on the bar without a filter drawer on phones', async () => {
  await renderToolbar({ phone: true })
  const user = userEvent.setup()
  for (const name of ['Hide', 'Refresh', 'Export', /More filters/]) {
    expect(screen.getByRole('button', { name })).toBeVisible()
  }
  expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Hide' }))
  expect(screen.getByRole('button', { name: 'Show' })).toBeVisible()
})

function LoadingFixture(props: { loading: boolean; onSearch: () => void }) {
  const table = useReactTable({
    data: [],
    columns: [],
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <LogsFilterToolbar
      table={table}
      compactMobile
      mobilePinnedFilters={<span>Date Range</span>}
      primaryFilters={null}
      hasActiveFilters={false}
      onReset={() => {}}
      onSearch={props.onSearch}
      searchLoading={props.loading}
    />
  )
}

it('keeps Search visible while loading and prevents repeated searches', async () => {
  const original = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...original(query),
    matches: query === '(max-width: 640px)',
  }))
  const onSearch = vi.fn()
  const user = userEvent.setup()
  const view = render(<LoadingFixture loading onSearch={onSearch} />)
  const search = screen.getByRole('button', { name: 'Search' })
  expect(search).toBeVisible()
  expect(search).toBeDisabled()
  expect(search).toHaveAttribute('aria-busy', 'true')
  await user.click(search)
  expect(onSearch).not.toHaveBeenCalled()
  view.rerender(<LoadingFixture loading={false} onSearch={onSearch} />)
  expect(search).toBeEnabled()
  await user.click(search)
  expect(onSearch).toHaveBeenCalledTimes(1)
})

it('places the end action between Search and View on desktop', () => {
  function DesktopFixture() {
    const table = useReactTable({
      data: [],
      columns: [],
      getCoreRowModel: getCoreRowModel(),
    })
    return (
      <LogsFilterToolbar
        table={table}
        primaryFilters={null}
        actionEnd={<button type='button'>Export</button>}
        hasActiveFilters={false}
        onReset={() => {}}
        onSearch={() => {}}
      />
    )
  }
  render(<DesktopFixture />)
  const names = screen
    .getAllByRole('button')
    .map((button) => button.textContent)
  expect(names.slice(-4)).toEqual(['Reset', 'Search', 'Export', 'View'])
})

it.each([
  { language: 'zh', resources: zh.translation },
  { language: 'zh-TW', resources: zhTW.translation },
])(
  'labels the calendar-month preset as 本月 in $language and selects the complete month',
  async ({ language, resources }) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 8, 12))
    i18next.addResourceBundle(language, 'translation', resources, true, true)
    await i18next.changeLanguage(language)
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CompactDateTimeRangePicker
        start={new Date(2026, 7, 10)}
        end={new Date(2026, 8, 8)}
        onChange={onChange}
      />
    )
    await user.click(screen.getByRole('button', { name: /^2026/ }))
    const preset = screen.getByRole('button', { name: '本月' })
    expect(preset).toBeVisible()
    await user.click(preset)
    expect(onChange).toHaveBeenCalledWith({
      start: new Date(2026, 8, 1),
      end: new Date(2026, 8, 30, 23, 59, 59, 999),
    })
  }
)

it('keeps the seconds of the current range when it is confirmed again', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <CompactDateTimeRangePicker
      start={new Date(2026, 8, 7, 9, 30, 15)}
      end={new Date(2026, 8, 8, 17, 45, 59)}
      onChange={onChange}
    />
  )
  await user.click(screen.getByRole('button', { name: /^2026/ }))
  await user.click(screen.getByRole('button', { name: 'Confirm' }))
  expect(onChange).toHaveBeenCalledWith({
    start: new Date(2026, 8, 7, 9, 30, 15),
    end: new Date(2026, 8, 8, 17, 45, 59),
  })
})

it('shows the seconds of the selected range on the trigger', () => {
  render(
    <CompactDateTimeRangePicker
      start={new Date(2026, 8, 7, 9, 30, 15)}
      end={new Date(2026, 8, 8, 17, 45, 59)}
      onChange={() => undefined}
    />
  )
  expect(
    screen.getByRole('button', {
      name: '2026-09-07 09:30:15 ~ 2026-09-08 17:45:59',
    })
  ).toBeVisible()
})
