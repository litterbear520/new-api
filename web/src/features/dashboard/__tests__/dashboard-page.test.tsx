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
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { Dashboard } from '..'

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // The charts' data never arrives; only the page frame is checked here.
  vi.spyOn(api, 'get').mockImplementation(() => new Promise(() => undefined))
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'root', role: ROLE.ADMIN })
})

afterEach(() => {
  cleanup()
  client.clear()
  useAuthStore.getState().auth.reset()
})

async function renderDashboard(section: string) {
  const root = createRootRoute({ component: Outlet })
  const authed = createRoute({
    getParentRoute: () => root,
    id: '_authenticated',
    component: Outlet,
  })
  const dashboard = createRoute({
    getParentRoute: () => authed,
    path: 'dashboard/$section',
    component: Dashboard,
  })
  const router = createRouter({
    routeTree: root.addChildren([authed.addChildren([dashboard])]),
    history: createMemoryHistory({ initialEntries: [`/dashboard/${section}`] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('dashboard sections', () => {
  it('describes the flow tab in one line', async () => {
    await renderDashboard('flow')
    expect(
      await screen.findByText(
        'How requests flow from users through groups and models to channels.'
      )
    ).toBeInTheDocument()
  })

  it('describes the user analytics tab in one line', async () => {
    await renderDashboard('users')
    expect(
      await screen.findByText(
        'Which users spend the most, and how their spending changes over time.'
      )
    ).toBeInTheDocument()
  })

  it('keeps the site-wide tabs from users who are not admins', async () => {
    useAuthStore
      .getState()
      .auth.setUser({ id: 2, username: 'bear', role: ROLE.USER })
    await renderDashboard('flow')
    expect(
      await screen.findByRole('heading', { name: 'Usage statistics' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Flow' })).not.toBeInTheDocument()
  })
})
