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
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { ThemeProvider } from '@/context/theme-provider'

import { HomeView } from '../components/home/home-view'

const realScrollTo = Element.prototype.scrollTo
const scrollTo = vi.fn()

beforeEach(() => {
  scrollTo.mockClear()
  // jsdom has no scrolling
  Element.prototype.scrollTo = scrollTo
})

afterEach(() => {
  Element.prototype.scrollTo = realScrollTo
})

function renderHome() {
  const root = createRootRoute()
  const draw = createRoute({
    getParentRoute: () => root,
    path: '/draw',
    component: () => (
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <div data-slot='console-scroller'>
            <HomeView />
          </div>
        </ThemeProvider>
      </QueryClientProvider>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([draw]),
    history: createMemoryHistory({ initialEntries: ['/draw'] }),
  })
  return render(<RouterProvider router={router} />)
}

test('a starter picked from down the page goes back up to the composer', async () => {
  const user = userEvent.setup()
  const { container } = renderHome()
  const pill = await waitFor(() => {
    const el = container.querySelector<HTMLElement>('.bd-pill')
    if (!el) throw new Error('no pill')
    return el
  })

  await user.click(pill)
  const starter = container.querySelector<HTMLElement>('.bd-starter')
  if (!starter) throw new Error('no starter')
  await user.click(starter)

  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  const composer = container.querySelector('textarea')
  expect(composer?.value).not.toBe('')
  expect(document.activeElement).toBe(composer)
})
