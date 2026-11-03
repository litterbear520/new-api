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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { STATUS_QUERY_KEY } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

import { NightSeaHome } from '../night-sea-home'

/** The /sign-in and /sign-up pages as the app routes them, plus a bare home. */
function renderAt(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  })
  client.setQueryData(STATUS_QUERY_KEY, {
    register_enabled: true,
    password_register_enabled: true,
  })
  const root = createRootRoute({ component: Outlet })
  const route = (to: string, component: () => React.ReactNode) =>
    createRoute({ getParentRoute: () => root, path: to, component })
  const router = createRouter({
    routeTree: root.addChildren([
      route('/', () => <div>Home page</div>),
      route('/sea', () => <NightSeaHome isAuthenticated={false} />),
      route('/sign-in', () => (
        <NightSeaHome isAuthenticated={false} authView='sign-in' />
      )),
      route('/sign-up', () => (
        <NightSeaHome isAuthenticated={false} authView='sign-up' />
      )),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return Object.assign(router, { unmount: view.unmount })
}

const renderHome = () => renderAt('/sea')

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  // jsdom has no canvas; the sky and the liquid glass both stand down.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => null
  )
  useAuthStore.getState().auth.reset('complete')
})

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'clipboard')
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  useAuthStore.getState().auth.reset('idle')
})

it('arrives at /sign-in with the home page sign-in dialog open', async () => {
  renderAt('/sign-in')

  expect(await screen.findByRole('dialog')).toHaveAccessibleName('Sign in')
  expect(
    screen.queryByText('Set sail with Little Bear')
  ).not.toBeInTheDocument()
})

it('says what it is on the first screen, with nothing else over the sky', async () => {
  renderAt('/sea')

  const title = await screen.findByRole('heading', {
    level: 1,
    name: '万千模型 汇于一点',
  })
  const first = title.closest('.ns-first')
  expect(first).toHaveTextContent('所有模型 一个接口')
  expect(first?.querySelector('.ns-offer-pill')).toBeNull()
  expect(first?.querySelector('.ns-endpoint')).toBeNull()
  expect(first?.querySelector('.ns-prayer')).toBeNull()
  expect(screen.getByRole('link', { name: '往下看看' })).toHaveAttribute(
    'href',
    '#ns-more'
  )
})

it('brings in the rest of the page when the visitor goes to scroll', async () => {
  renderAt('/sea')

  await screen.findByRole('heading', { level: 1 })
  expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
  // the room to scroll into, and where the arrow goes, are there from the start
  expect(document.querySelector('#ns-more')).not.toBeNull()

  fireEvent.scroll(window)

  expect(await screen.findByRole('contentinfo')).toHaveTextContent('模型广场')
  expect(
    await screen.findByRole('heading', { level: 2, name: '所有模型 一个入口' })
  ).toBeInTheDocument()
  expect(document.querySelectorAll('#ns-more')).toHaveLength(1)
})

it('dresses the browser in the night while it shows, not after', async () => {
  const { unmount } = renderHome()
  await screen.findByRole('heading', { level: 1 })
  expect(document.documentElement).toHaveClass('ns-night-page')
  unmount()
  expect(document.documentElement).not.toHaveClass('ns-night-page')
})

it('arrives at /sign-up with the sign-up view open', async () => {
  renderAt('/sign-up')

  expect(
    await screen.findByRole('heading', { name: 'Create an account' })
  ).toBeVisible()
})

it('leaves for the home page when the dialog is closed', async () => {
  const router = renderAt('/sign-in')
  const user = userEvent.setup()

  await screen.findByRole('dialog')
  await user.keyboard('{Escape}')

  await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  expect(await screen.findByText('Home page')).toBeVisible()
})
