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
import { useAuthStore, type AuthBundle } from '@/stores/auth-store'

import { renderAuthRoute } from '../../__tests__/auth-route-harness'

const passwordOnlyStatus = { password_login_enabled: true }

const bundle: AuthBundle = {
  access_token: 'signed-in',
  token_type: 'Bearer',
  access_expires_at: 9999999999,
  user: { id: 7, username: 'bear', role: 1 },
  session: {
    sid: 'password-session',
    current: true,
    login_method: 'password',
    ip: '',
    user_agent: '',
    created_at: 1,
    last_active_at: 1,
    expires_at: 9999999999,
  },
}

async function reachPasswordStep(identifier: string) {
  const user = userEvent.setup()
  await user.type(
    await screen.findByLabelText('Username or Email'),
    `${identifier}{Enter}`
  )
  await screen.findByLabelText('Password')
  return user
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  useAuthStore.getState().auth.reset('complete')
})

afterEach(() => {
  useAuthStore.getState().auth.reset('idle')
})

it('keeps Continue disabled until a non-blank identifier is typed', async () => {
  const user = userEvent.setup()
  renderAuthRoute({ url: '/sign-in', status: passwordOnlyStatus })

  const continueButton = await screen.findByRole('button', {
    name: 'Continue',
  })
  expect(continueButton).toBeDisabled()

  const identifier = screen.getByLabelText('Username or Email')
  await user.type(identifier, '   ')
  expect(continueButton).toBeDisabled()

  await user.type(identifier, 'bear@example.com')
  expect(continueButton).toBeEnabled()
})

it('moves to the password step on Enter without sending a login request', async () => {
  const post = vi.spyOn(api, 'post')
  renderAuthRoute({ url: '/sign-in', status: passwordOnlyStatus })

  await reachPasswordStep('  bear@example.com ')

  expect(screen.getByLabelText('Password')).toHaveFocus()
  expect(screen.getByText('bear@example.com')).toBeVisible()
  expect(screen.queryByLabelText('Username or Email')).not.toBeInTheDocument()
  expect(post).not.toHaveBeenCalled()
})

it('returns to the identifier step on Change, keeping the identifier and clearing the password', async () => {
  renderAuthRoute({ url: '/sign-in', status: passwordOnlyStatus })
  const user = await reachPasswordStep('bear@example.com')
  await user.type(screen.getByLabelText('Password'), 'secret-1')

  await user.click(screen.getByRole('button', { name: 'Change' }))

  const identifier = await screen.findByLabelText('Username or Email')
  expect(identifier).toHaveValue('bear@example.com')
  expect(identifier).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  expect(await screen.findByLabelText('Password')).toHaveValue('')
})

it('signs in with the trimmed identifier and password, then opens the requested page', async () => {
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true, data: bundle } })
  const { router } = renderAuthRoute({
    url: '/sign-in?redirect=/pricing',
    status: passwordOnlyStatus,
  })
  const user = await reachPasswordStep(' bear@example.com ')

  await user.type(screen.getByLabelText('Password'), 'secret-1{Enter}')

  await waitFor(() => expect(router.state.location.pathname).toBe('/pricing'))
  expect(post).toHaveBeenCalledTimes(1)
  expect(post).toHaveBeenCalledWith(
    '/api/user/login?turnstile=',
    { username: 'bear@example.com', password: 'secret-1' },
    expect.anything()
  )
  expect(useAuthStore.getState().auth.user?.id).toBe(7)
})

it('stays on the password step when the server rejects the password', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: false, message: 'Invalid username or password' },
  })
  const { router } = renderAuthRoute({
    url: '/sign-in',
    status: passwordOnlyStatus,
  })
  const user = await reachPasswordStep('bear@example.com')

  await user.type(screen.getByLabelText('Password'), 'wrong{Enter}')

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  )
  expect(screen.getByLabelText('Password')).toBeVisible()
  expect(screen.getByText('bear@example.com')).toBeVisible()
  expect(router.state.location.pathname).toBe('/sign-in')
  expect(useAuthStore.getState().auth.user).toBeNull()
})

it('opens the verification page when the account requires two-factor verification', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({
    data: {
      success: true,
      data: {
        require_verification: true,
        flow_token: 'login-flow',
        expires_at: Math.floor(Date.now() / 1000) + 300,
        methods: [{ method: '2fa', available: true }],
      },
    },
  })
  const { router } = renderAuthRoute({
    url: '/sign-in',
    status: passwordOnlyStatus,
  })
  const user = await reachPasswordStep('bear@example.com')

  await user.type(screen.getByLabelText('Password'), 'secret-1{Enter}')

  await waitFor(() => expect(router.state.location.pathname).toBe('/otp'))
  expect(useAuthStore.getState().auth.user).toBeNull()
})
