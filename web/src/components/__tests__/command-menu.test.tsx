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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

import { SearchProvider } from '@/context/search-provider'
import { ROLE } from '@/lib/roles'
import { STATUS_QUERY_KEY } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'
import { useNightSeaStore } from '@/stores/night-sea-store'

import { CommandMenu } from '../command-menu'
import { Search } from '../search'

const adminEntries = ['Channels', 'Models', 'Users', 'Redemption Codes']
const superAdminEntries = ['System Info', 'Task Plugins', 'System Settings']

// jsdom lacks the Web Animations API the menu's scroll area waits on.
const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})

afterAll(() => {
  if (getAnimationsDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'getAnimations',
      getAnimationsDescriptor
    )
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
  }
})

afterEach(() => {
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  useNightSeaStore.setState({ found: false, on: false })
  window.localStorage.clear()
})

async function openSearch(role: number, sidebarModulesAdmin = '') {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'alice', role })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(STATUS_QUERY_KEY, {
    SidebarModulesAdmin: sidebarModulesAdmin,
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <SearchProvider>
          <Search />
          <CommandMenu />
        </SearchProvider>
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

  await userEvent.click(await screen.findByRole('button', { name: 'Search' }))
  return router
}

async function searchEntriesFor(role: number, sidebarModulesAdmin = '') {
  await openSearch(role, sidebarModulesAdmin)
  const options = await screen.findAllByRole('option')
  return options.map((option) => option.textContent)
}

test('the security entry opens its account settings section', async () => {
  const router = await openSearch(ROLE.USER)

  await userEvent.click(
    await screen.findByRole('option', { name: 'Sign-in & security' })
  )

  await waitFor(() => expect(router.state.location.pathname).toBe('/profile'))
  expect(router.state.location.search).toEqual({ section: 'security' })
})

test('regular users only find their own console pages in search', async () => {
  const entries = await searchEntriesFor(ROLE.USER)

  expect(entries).toEqual(
    expect.arrayContaining([
      'API Keys',
      'Usage Logs',
      'Wallet',
      'Account settings',
    ])
  )
  for (const entry of [...adminEntries, ...superAdminEntries]) {
    expect(entries).not.toContain(entry)
  }
})

test('admins find admin pages in search but not super admin pages', async () => {
  const entries = await searchEntriesFor(ROLE.ADMIN)

  expect(entries).toEqual(expect.arrayContaining(adminEntries))
  for (const entry of superAdminEntries) {
    expect(entries).not.toContain(entry)
  }
})

test('pages hidden in the sidebar settings stay out of search', async () => {
  const entries = await searchEntriesFor(
    ROLE.USER,
    JSON.stringify({ personal: { enabled: true, topup: false } })
  )

  expect(entries).not.toContain('Wallet')
  expect(entries).toContain('Account settings')
})

test('search offers the light and dark themes but no system theme', async () => {
  const entries = (await searchEntriesFor(ROLE.USER)).map((entry) =>
    entry?.trim()
  )

  expect(entries).toEqual(expect.arrayContaining(['Light', 'Dark']))
  expect(entries).not.toContain('System')
})

test('picking light in search turns the night sea off', async () => {
  useNightSeaStore.setState({ found: true, on: true })
  await openSearch(ROLE.USER)

  await userEvent.click(await screen.findByRole('option', { name: 'Light' }))

  expect(useNightSeaStore.getState()).toMatchObject({ found: true, on: false })
})
