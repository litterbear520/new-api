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
import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import { ThemeProvider } from '@/context/theme-provider'
import { ROLE } from '@/lib/roles'
import { STATUS_QUERY_KEY } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

import { ConsoleScroller } from '../components/console-scroller'

afterEach(() => {
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  window.localStorage.clear()
})

async function renderConsole() {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'alice',
    role: ROLE.USER,
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(STATUS_QUERY_KEY, { system_name: '小熊API' })
  client.setQueryData(['notice'], '')
  const root = createRootRoute({
    component: () => (
      <ThemeProvider>
        <SidebarProvider>
          <ConsoleScroller>
            <Outlet />
          </ConsoleScroller>
        </SidebarProvider>
      </ThemeProvider>
    ),
  })
  const page = (path: string) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: () => <h1>{path}</h1>,
    })
  const router = createRouter({
    routeTree: root.addChildren([page('/wallet'), page('/invite')]),
    history: createMemoryHistory({ initialEntries: ['/wallet'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await screen.findByRole('heading', { name: '/wallet' })
  const scroller = document.querySelector<HTMLElement>(
    '[data-slot="console-scroller"]'
  )
  if (!scroller) throw new Error('no console scroller')
  return { router, scroller }
}

test('opening another page starts it at the top', async () => {
  const { router, scroller } = await renderConsole()
  scroller.scrollTop = 300

  await act(() => router.navigate({ to: '/invite' }))

  expect(
    await screen.findByRole('heading', { name: '/invite' })
  ).toBeInTheDocument()
  expect(scroller.scrollTop).toBe(0)
})
