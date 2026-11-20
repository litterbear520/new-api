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

const passwordOnlyStatus = { password_login_enabled: true }

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  useAuthStore.getState().auth.reset('complete')
})

afterEach(() => {
  useAuthStore.getState().auth.reset('idle')
})

it('keeps a typed username as typed, with Next on the phone keyboard', async () => {
  renderAuthRoute({ url: '/sign-in', status: passwordOnlyStatus })

  const identifier = await screen.findByLabelText('Username or Email')

  expect(identifier).toHaveAttribute('autocapitalize', 'none')
  expect(identifier).toHaveAttribute('autocorrect', 'off')
  expect(identifier).toHaveAttribute('spellcheck', 'false')
  expect(identifier).toHaveAttribute('enterkeyhint', 'next')
})

it('shows Done on the phone keyboard for the password, the last field', async () => {
  renderAuthRoute({ url: '/sign-in', status: passwordOnlyStatus })
  const user = userEvent.setup()

  await user.type(
    await screen.findByLabelText('Username or Email'),
    'bear{Enter}'
  )

  expect(await screen.findByLabelText('Password')).toHaveAttribute(
    'enterkeyhint',
    'done'
  )
})
