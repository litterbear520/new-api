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

import { useAuthStore } from '@/stores/auth-store'

import { renderAuthRoute } from '../../__tests__/auth-route-harness'

const signUpStatus = {
  register_enabled: true,
  password_register_enabled: true,
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  useAuthStore.getState().auth.reset('complete')
})

afterEach(() => {
  useAuthStore.getState().auth.reset('idle')
})

it('marks the username for autofill and keeps it as typed', async () => {
  renderAuthRoute({ url: '/sign-up', status: signUpStatus })

  const username = await screen.findByLabelText('Username')

  expect(username).toHaveAttribute('autocomplete', 'username')
  expect(username).toHaveAttribute('autocapitalize', 'none')
  expect(username).toHaveAttribute('autocorrect', 'off')
  expect(username).toHaveAttribute('spellcheck', 'false')
})

it('asks for the new password once, marked for a suggested strong password', async () => {
  renderAuthRoute({ url: '/sign-up', status: signUpStatus })

  const password = await screen.findByLabelText('Password')

  expect(password).toHaveAttribute('autocomplete', 'new-password')
  expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument()
  expect(document.querySelectorAll('input[type="password"]')).toHaveLength(1)
})

it('shows the password while the show-password button is pressed', async () => {
  renderAuthRoute({ url: '/sign-up', status: signUpStatus })
  const user = userEvent.setup()
  const password = await screen.findByLabelText('Password')
  const toggle = screen.getByRole('button', { name: 'Show password' })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await user.click(toggle)

  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(password).toHaveAttribute('type', 'text')

  await user.click(toggle)

  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(password).toHaveAttribute('type', 'password')
})

it('labels the emailed code field and offers the code from the mail for autofill', async () => {
  renderAuthRoute({
    url: '/sign-up',
    status: { ...signUpStatus, email_verification: true },
  })

  expect(
    await screen.findByLabelText('Email (required for verification)')
  ).toHaveAttribute('autocomplete', 'email')
  const code = screen.getByLabelText('Verification code')
  expect(code).toHaveAttribute('autocomplete', 'one-time-code')
  expect(code).toHaveAttribute('autocapitalize', 'none')
  expect(code).toHaveAttribute('spellcheck', 'false')
})
