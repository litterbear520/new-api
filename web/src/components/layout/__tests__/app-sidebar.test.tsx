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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { ROLE } from '@/lib/roles'
import { STATUS_QUERY_KEY } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

import { AppSidebar } from '../components/app-sidebar'

afterEach(() => {
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  window.localStorage.clear()
})

async function renderSidebar() {
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'alice', role: ROLE.USER })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(STATUS_QUERY_KEY, {
    system_name: '小熊API',
    docs_link: '/docs/',
    HeaderNavModules: JSON.stringify({
      pricing: { enabled: true, requireAuth: false },
      rankings: { enabled: false, requireAuth: false },
      about: false,
    }),
  })
  client.setQueryData(['notice'], '')
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <LayoutProvider>
          <SearchProvider>
            <SidebarProvider>
              <AppSidebar />
            </SidebarProvider>
          </SearchProvider>
        </LayoutProvider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/dashboard/overview'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await screen.findByRole('link', { name: 'Go to home' })
}

test('keeps search but leaves messages and the account to the top bar', async () => {
  await renderSidebar()

  expect(screen.getByRole('button', { name: /Search/ })).toBeInTheDocument()
  expect(screen.queryByText('Message center')).not.toBeInTheDocument()
  expect(screen.queryByText('alice')).not.toBeInTheDocument()
})

test('names the collapse button after what it does next', async () => {
  await renderSidebar()

  await userEvent.click(
    screen.getByRole('button', { name: 'Collapse sidebar' })
  )
  expect(
    screen.getByRole('button', { name: 'Expand sidebar' })
  ).toBeInTheDocument()
})

test('lists the site links once, for narrow screens where the dock drops them', async () => {
  await renderSidebar()

  const site = screen.getByRole('list', { name: 'Site links' })
  expect(
    within(site)
      .getAllByRole('link')
      .map((link) => [link.textContent, link.getAttribute('href')])
  ).toEqual([
    ['Home', '/'],
    ['Model Square', '/pricing'],
    ['Offers', '/activity'],
    ['Docs', '/docs/'],
  ])
  // wide screens have them in the top bar instead
  expect(site.closest('.lg\\:hidden')).not.toBeNull()
  expect(screen.getAllByRole('link', { name: /Model Square/ })).toHaveLength(1)
})
