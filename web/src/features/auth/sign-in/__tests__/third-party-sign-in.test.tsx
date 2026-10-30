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
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { renderAuthRoute } from '../../__tests__/auth-route-harness'

const providers = {
  password_login_enabled: true,
  github_oauth: true,
  github_client_id: 'gh-client',
  oidc_enabled: true,
  oidc_display_name: 'Google',
  oidc_client_id: 'google-client',
  oidc_authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  useAuthStore.getState().auth.reset('complete')
})

afterEach(() => {
  useAuthStore.getState().auth.reset('idle')
})

it('shows third-party sign-in above the email form when providers are enabled', async () => {
  renderAuthRoute({ url: '/sign-in', status: providers })

  const github = await screen.findByRole('button', {
    name: 'Continue with GitHub',
  })
  const identifier = screen.getByLabelText('Username or Email')

  expect(
    github.compareDocumentPosition(identifier) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
  expect(screen.getByText('or')).toBeVisible()
})

it('sends GitHub and Google to the main line sign-in page when opened on another line', async () => {
  const post = vi.spyOn(api, 'post')
  renderAuthRoute({
    url: '/sign-in?redirect=/pricing',
    status: { ...providers, server_address: 'https://main.example.com/' },
  })

  const expected = 'https://main.example.com/sign-in?redirect=%2Fpricing'
  expect(
    await screen.findByRole('link', { name: 'Continue with GitHub' })
  ).toHaveAttribute('href', expected)
  expect(
    screen.getByRole('link', { name: 'Continue with Google' })
  ).toHaveAttribute('href', expected)
  expect(
    screen.getByText('Third-party sign-in continues on main.example.com')
  ).toBeVisible()
  expect(post).not.toHaveBeenCalled()
})

it('keeps WeChat sign-in as an in-page button when opened on another line', async () => {
  renderAuthRoute({
    url: '/sign-in',
    status: {
      ...providers,
      wechat_login: true,
      server_address: 'https://main.example.com',
    },
  })

  expect(
    await screen.findByRole('button', { name: 'Continue with WeChat' })
  ).toBeEnabled()
  expect(
    screen.queryByRole('link', { name: 'Continue with WeChat' })
  ).not.toBeInTheDocument()
})

it.each([
  ['the main line', () => `${window.location.origin}/`],
  ['a site without a server address', () => ''],
])('starts GitHub sign-in in place on %s', async (_case, serverAddress) => {
  const post = vi.spyOn(api, 'post').mockImplementation(async (url) => {
    if (url === '/api/oauth/state') {
      return { data: { success: true, data: 'state-1' } }
    }
    return { data: { success: true, message: '' } }
  })
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  renderAuthRoute({
    url: '/sign-in',
    status: { ...providers, server_address: serverAddress() },
  })
  const user = userEvent.setup()

  await user.click(
    await screen.findByRole('button', { name: 'Continue with GitHub' })
  )

  await waitFor(() =>
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://github.com/login/oauth/authorize?client_id=gh-client&state=state-1'
      ),
      '_self'
    )
  )
  expect(post).toHaveBeenCalledWith(
    '/api/oauth/state',
    expect.objectContaining({ provider: 'github', intent: 'login' }),
    expect.anything()
  )
  expect(
    screen.queryByText(/Third-party sign-in continues on/)
  ).not.toBeInTheDocument()
})
