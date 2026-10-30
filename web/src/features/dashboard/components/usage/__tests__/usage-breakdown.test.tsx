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
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import type { BreakdownRow } from '../../../lib/usage-stats'
import { UsageBreakdown } from '../usage-breakdown'

const RANGE = {
  start: new Date('2026-10-21T00:00:00'),
  end: new Date('2026-10-27T23:59:59'),
}
const FORMAT = {
  quota: (value: number) => `$${value}`,
  requests: String,
  tokens: String,
}

afterEach(() => {
  cleanup()
})

async function renderBreakdown(rows: BreakdownRow[]) {
  const root = createRootRoute({ component: Outlet })
  const page = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => (
      <UsageBreakdown
        kind='models'
        rows={rows}
        metric='quota'
        loading={false}
        range={RANGE}
        format={FORMAT}
      />
    ),
  })
  const logs = createRoute({
    getParentRoute: () => root,
    path: '/usage-logs/$section',
    component: () => <p>Logs page</p>,
  })
  const router = createRouter({
    routeTree: root.addChildren([page, logs]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  return router
}

function modelRow(name: string): BreakdownRow {
  return {
    id: `model:${name}`,
    name,
    family: 'gpt',
    logs: { model: name },
    quota: 3,
    requests: 2,
    tokens: 40,
  }
}

describe('usage breakdown', () => {
  it('truncates a long name inside its cell', async () => {
    const name = `gpt-${'x'.repeat(80)}`
    await renderBreakdown([modelRow(name)])
    const link = await screen.findByRole('link', { name })
    // Auto table layout ignores max-width on a cell, so the limit sits on
    // the element around the truncating name.
    expect(link).toHaveClass('truncate')
    expect(link.parentElement).toHaveClass('max-w-56')
    expect(link.closest('td')).not.toHaveClass('max-w-56')
  })

  it('opens the logs for that model and range when a row is clicked', async () => {
    const user = userEvent.setup()
    const router = await renderBreakdown([modelRow('gpt-6.1-sol')])
    await user.click(await screen.findByRole('cell', { name: '$3' }))
    expect(await screen.findByText('Logs page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/usage-logs/common')
    expect(router.state.location.search).toEqual({
      model: 'gpt-6.1-sol',
      startTime: RANGE.start.getTime(),
      endTime: RANGE.end.getTime(),
    })
  })
})
