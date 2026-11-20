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
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { AuthenticatedLayout, Main } from '@/components/layout'
import { ROLE } from '@/lib/roles'
import { STATUS_QUERY_KEY } from '@/lib/status-query'
import { Route as RootRoute } from '@/routes/__root'
import { useAuthStore } from '@/stores/auth-store'

// The bar's own behaviour is tested in site-bar.test.tsx; here it only has
// to stand where it does, with something to tab through.
vi.mock('@/components/site-bar/site-bar', () => ({
  SiteBar: () => (
    <header>
      <a href='/'>Brand</a>
      <button type='button'>Language</button>
    </header>
  ),
}))

afterEach(() => {
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  window.localStorage.clear()
})

/** The real root and console layout, with one console page and one public page. */
async function renderAt(url: string) {
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'alice', role: ROLE.USER })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(STATUS_QUERY_KEY, { system_name: '小熊API' })
  client.setQueryData(['notice'], '')
  const root = createRootRoute({ component: RootRoute.options.component })
  const consoleRoute = createRoute({
    getParentRoute: () => root,
    id: '_authenticated',
    component: AuthenticatedLayout,
  })
  const router = createRouter({
    routeTree: root.addChildren([
      consoleRoute.addChildren([
        createRoute({
          getParentRoute: () => consoleRoute,
          path: 'wallet',
          component: () => (
            <Main>
              <h1>Wallet</h1>
              <button type='button'>Top up</button>
            </Main>
          ),
        }),
      ]),
      createRoute({
        getParentRoute: () => root,
        path: 'about',
        component: () => <h1>About</h1>,
      }),
    ]),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

test('on a console page the first Tab reaches the skip link, before the site bar', async () => {
  await renderAt('/wallet')
  await screen.findByRole('heading', { name: 'Wallet' })
  const user = userEvent.setup()

  await user.tab()

  const skip = screen.getByRole('link', { name: 'Skip to Main' })
  expect(skip).toHaveFocus()
  expect(
    skip.compareDocumentPosition(screen.getByRole('banner')) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
})

test('the skip link moves focus into the page, the one main landmark', async () => {
  await renderAt('/wallet')
  await screen.findByRole('heading', { name: 'Wallet' })
  const user = userEvent.setup()

  await user.tab()
  await user.keyboard('{Enter}')

  const main = screen.getByRole('main')
  expect(main).toHaveFocus()
  expect(main).toHaveAttribute('id', 'content')
  expect(main).toContainElement(screen.getByRole('heading', { name: 'Wallet' }))
  await user.tab()
  expect(screen.getByRole('button', { name: 'Top up' })).toHaveFocus()
})

test('outside the console there is no skip link', async () => {
  await renderAt('/about')
  await screen.findByRole('heading', { name: 'About' })

  expect(
    screen.queryByRole('link', { name: 'Skip to Main' })
  ).not.toBeInTheDocument()
})
