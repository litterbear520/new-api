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
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { LogsEmpty } from '../logs-empty'

const FILTERS = {
  model: 'gpt-5.5',
  token: 'backend',
  group: 'default',
  requestId: 'req-1',
  upstreamRequestId: 'up-1',
  username: 'alice',
  channel: '7',
  filter: 'task-1',
}

function renderEmpty(search: string) {
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const logs = createRoute({
    getParentRoute: () => auth,
    path: '/usage-logs/$section',
    component: () => <LogsEmpty section='common' />,
    validateSearch: (value: Record<string, unknown>) => value,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([logs])]),
    history: createMemoryHistory({
      initialEntries: [`/usage-logs/common${search}`],
    }),
  })
  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  vi.restoreAllMocks()
})

it('draws the placeholder rows without clashing React keys', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

  renderEmpty('')
  await screen.findByText('No logs in this range')

  expect(consoleError.mock.calls.flat().join(' ')).not.toContain('same key')
})

it('offers no clearing and shows the section hint without filters', async () => {
  renderEmpty('')

  expect(
    await screen.findByText('Every request your keys send shows up here.')
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Clear filters' })
  ).not.toBeInTheDocument()
})

it('offers clearing when only one filter field is set', async () => {
  renderEmpty('?upstreamRequestId=up-1')

  expect(
    await screen.findByRole('button', { name: 'Clear filters' })
  ).toBeVisible()
})

it('clears every filter field and the type on Clear filters', async () => {
  const user = userEvent.setup()
  const router = renderEmpty(
    `?${new URLSearchParams(FILTERS).toString()}&type=%5B%222%22%5D&page=3`
  )

  await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

  await waitFor(() =>
    expect(router.state.location.search).toEqual(
      expect.objectContaining({ page: 1, type: ['0'] })
    )
  )
  for (const field of Object.keys(FILTERS)) {
    expect(router.state.location.search).not.toHaveProperty(field)
  }
})
