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
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { renderAuthRoute } from '../../__tests__/auth-route-harness'

const signUpStatus = {
  register_enabled: true,
  password_register_enabled: true,
  github_oauth: true,
  github_client_id: 'gh-client',
  privacy_policy_enabled: true,
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  useAuthStore.getState().auth.reset('complete')
})

afterEach(() => {
  useAuthStore.getState().auth.reset('idle')
})

it('shows third-party sign-up above the form when a provider is enabled', async () => {
  renderAuthRoute({ url: '/sign-up', status: signUpStatus })

  const github = await screen.findByRole('button', {
    name: 'Continue with GitHub',
  })
  expect(github).toBeEnabled()
  expect(
    github.compareDocumentPosition(screen.getByLabelText('Username')) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
})

it('enables Create account without a consent checkbox when a privacy policy is published', async () => {
  renderAuthRoute({ url: '/sign-up', status: signUpStatus })

  expect(
    await screen.findByRole('button', { name: 'Create account' })
  ).toBeEnabled()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.getByText(/By signing up, you agree to the/)).toBeVisible()
})

it('links third-party sign-up to the main line sign-in page when opened on another line', async () => {
  renderAuthRoute({
    url: '/sign-up',
    status: { ...signUpStatus, server_address: 'https://main.example.com' },
  })

  expect(
    await screen.findByRole('link', { name: 'Continue with GitHub' })
  ).toHaveAttribute('href', 'https://main.example.com/sign-in')
})

it('creates the account and opens sign-in when the form is submitted without consent', async () => {
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true, message: '' } })
  renderAuthRoute({ url: '/sign-up', status: signUpStatus })
  const user = userEvent.setup()

  await user.type(await screen.findByLabelText('Username'), 'little-bear')
  await user.type(screen.getByLabelText('Password'), 'Bear-pass-2026')
  await user.type(screen.getByLabelText('Confirm password'), 'Bear-pass-2026')
  await user.click(screen.getByRole('button', { name: 'Create account' }))

  // /sign-up is the home page dialog, which turns to sign-in in place.
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(post).toHaveBeenCalledWith(
    '/api/user/register',
    expect.objectContaining({
      username: 'little-bear',
      password: 'Bear-pass-2026',
    }),
    expect.anything()
  )
})
