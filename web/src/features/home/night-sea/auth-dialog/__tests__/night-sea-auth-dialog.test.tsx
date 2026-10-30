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
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { STATUS_QUERY_KEY, type StatusData } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

import { NightSeaAuthDialog } from '../night-sea-auth-dialog'
import { useNightSeaAuth } from '../use-night-sea-auth'

const status = {
  register_enabled: true,
  password_register_enabled: true,
  github_oauth: true,
  github_client_id: 'gh-client',
  privacy_policy_enabled: true,
}

function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const auth = useNightSeaAuth()
  return (
    <>
      <canvas ref={canvasRef} />
      <Link to='/sign-in' onClick={auth.trigger('sign-in')}>
        Open sign-in
      </Link>
      <Link to='/sign-up' onClick={auth.trigger('sign-up')}>
        Open sign-up
      </Link>
      <NightSeaAuthDialog canvasRef={canvasRef} {...auth.dialogProps} />
    </>
  )
}

/** The home page's links and dialog inside an in-memory router, `/api/status` seeded. */
function renderHome(props: { status?: StatusData } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  })
  client.setQueryData(STATUS_QUERY_KEY, props.status ?? status)
  const root = createRootRoute({ component: Outlet })
  const page = (path: string, text: string) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: () => <div>{text}</div>,
    })
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: '/', component: Home }),
      page('/sign-in', 'Sign-in page'),
      page('/sign-up', 'Sign-up page'),
      page('/forgot-password', 'Forgot password page'),
      page('/dashboard', 'Dashboard page'),
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { router, ...view }
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  // jsdom has no WebGL; the dialog falls back to frosted glass.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => null
  )
  useAuthStore.getState().auth.reset('complete')
})

afterEach(() => {
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset('idle')
})

it('opens sign-in over the home page instead of leaving it', async () => {
  const { router } = renderHome()
  const user = userEvent.setup()

  await user.click(await screen.findByRole('link', { name: 'Open sign-in' }))

  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveAccessibleName('Sign in')
  expect(
    screen.getByRole('button', { name: 'Continue with GitHub' })
  ).toBeVisible()
  expect(router.state.location.pathname).toBe('/')
})

it('switches between sign-in and sign-up inside the dialog', async () => {
  renderHome()
  const user = userEvent.setup()

  await user.click(await screen.findByRole('link', { name: 'Open sign-in' }))
  await user.click(await screen.findByRole('button', { name: 'Sign up' }))
  expect(
    await screen.findByRole('heading', { name: 'Create an account' })
  ).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
})

it('returns to sign-in in the dialog after an account is created', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, message: '' },
  })
  const { router } = renderHome({
    status: { ...status, email_verification: false },
  })
  const user = userEvent.setup()

  await user.click(await screen.findByRole('link', { name: 'Open sign-up' }))
  await user.type(await screen.findByLabelText('Username'), 'little-bear')
  await user.type(screen.getByLabelText('Password'), 'Bear-pass-2026')
  await user.type(screen.getByLabelText('Confirm password'), 'Bear-pass-2026')
  await user.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(router.state.location.pathname).toBe('/')
})

it('only offers sign-in when registration is closed', async () => {
  renderHome({ status: { ...status, register_enabled: false } })
  const user = userEvent.setup()

  await user.click(await screen.findByRole('link', { name: 'Open sign-up' }))

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Sign up' })
  ).not.toBeInTheDocument()
})

it('closes on Escape', async () => {
  renderHome()
  const user = userEvent.setup()

  await user.click(await screen.findByRole('link', { name: 'Open sign-in' }))
  await screen.findByRole('dialog')
  await user.keyboard('{Escape}')

  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
})

it('leaves modified clicks to the browser', async () => {
  renderHome()

  fireEvent.click(await screen.findByRole('link', { name: 'Open sign-in' }), {
    ctrlKey: true,
  })

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('keeps the close button in place while the form scrolls', async () => {
  renderHome()
  const user = userEvent.setup()

  await user.click(await screen.findByRole('link', { name: 'Open sign-up' }))
  const dialog = await screen.findByRole('dialog')
  const close = screen.getByRole('button', { name: 'Close' })

  expect(dialog.querySelector('.ns-auth-body')).not.toContainElement(close)
})

it('places the card through the top offset its max-height reads', async () => {
  renderHome()
  const user = userEvent.setup()

  await user.click(await screen.findByRole('link', { name: 'Open sign-in' }))
  const dialog = await screen.findByRole('dialog')

  expect(dialog.style.getPropertyValue('--ns-auth-top')).toMatch(/^\d+px$/)
  expect(dialog.style.top).toBe('')
})

it('fades the edges where the form continues out of view', async () => {
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(
    function (this: Element) {
      return this.classList.contains('ns-auth-body') ? 700 : 0
    }
  )
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(
    function (this: Element) {
      return this.classList.contains('ns-auth-body') ? 358 : 0
    }
  )
  renderHome()
  const user = userEvent.setup()

  await user.click(await screen.findByRole('link', { name: 'Open sign-up' }))
  const body = (await screen.findByRole('dialog')).querySelector<HTMLElement>(
    '.ns-auth-body'
  )
  if (!body) throw new Error('no scrolling body')
  await waitFor(() => expect(body).toHaveAttribute('data-more-below'))
  expect(body).not.toHaveAttribute('data-more-above')

  body.scrollTop = 342
  fireEvent.scroll(body)

  expect(body).toHaveAttribute('data-more-above')
  expect(body).not.toHaveAttribute('data-more-below')
})

it('marks the main-line hint for the legibility style on another line', async () => {
  renderHome({
    status: { ...status, server_address: 'https://main.example.com' },
  })
  const user = userEvent.setup()

  await user.click(await screen.findByRole('link', { name: 'Open sign-in' }))
  const hint = await screen.findByText(
    'Third-party sign-in continues on main.example.com'
  )

  // The selector auth-dialog.css gives a text shadow (see layout.test.ts).
  expect(hint.matches(".ns-auth [data-slot='button'] ~ p")).toBe(true)
})
