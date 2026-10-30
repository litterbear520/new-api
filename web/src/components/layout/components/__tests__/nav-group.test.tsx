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
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'

import type { NavItem } from '../../types'
import { NavGroup } from '../nav-group'

const ITEMS: NavItem[] = [
  { title: 'Account settings', url: '/profile' },
  {
    title: 'Sign-in & security',
    url: '/profile',
    search: { section: 'security' },
  },
]

async function renderGroupAt(href: string) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <SidebarProvider>
          <NavGroup items={ITEMS} />
        </SidebarProvider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: [href] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
}

test('an item with search params links to them and is the only selected item when they match', async () => {
  await renderGroupAt('/profile?section=security')

  const security = await screen.findByRole('link', {
    name: 'Sign-in & security',
  })
  expect(security).toHaveAttribute('href', '/profile?section=security')
  expect(security).toHaveAttribute('data-active')
  expect(
    screen.getByRole('link', { name: 'Account settings' })
  ).not.toHaveAttribute('data-active')
})

test('the path-only item stays selected when the search params do not match', async () => {
  await renderGroupAt('/profile')

  expect(
    await screen.findByRole('link', { name: 'Account settings' })
  ).toHaveAttribute('data-active')
  expect(
    screen.getByRole('link', { name: 'Sign-in & security' })
  ).not.toHaveAttribute('data-active')
})
