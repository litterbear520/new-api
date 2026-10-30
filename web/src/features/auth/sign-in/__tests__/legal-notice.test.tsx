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
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { renderAuthRoute } from '../../__tests__/auth-route-harness'

const github = {
  password_login_enabled: true,
  github_oauth: true,
  github_client_id: 'gh-client',
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  useAuthStore.getState().auth.reset('complete')
  useSystemConfigStore.getState().setConfig({ systemName: '小熊API' })
})

afterEach(() => {
  useAuthStore.getState().auth.reset('idle')
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
})

it('enables every sign-in option without a consent checkbox when a privacy policy is published', async () => {
  renderAuthRoute({
    url: '/sign-in',
    status: { ...github, privacy_policy_enabled: true },
  })

  expect(
    await screen.findByRole('button', { name: 'Continue with GitHub' })
  ).toBeEnabled()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

it('names the site and links only the privacy policy when it is the only published document', async () => {
  renderAuthRoute({
    url: '/sign-in',
    status: { ...github, privacy_policy_enabled: true },
  })

  expect(
    await screen.findByText(/By continuing, you agree to the 小熊API/)
  ).toBeVisible()
  expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
    'href',
    '/privacy-policy'
  )
  expect(
    screen.queryByRole('link', { name: 'User Agreement' })
  ).not.toBeInTheDocument()
})

it('links both documents when the user agreement and privacy policy are published', async () => {
  renderAuthRoute({
    url: '/sign-in',
    status: {
      ...github,
      user_agreement_enabled: true,
      privacy_policy_enabled: true,
    },
  })

  expect(
    await screen.findByRole('link', { name: 'User Agreement' })
  ).toHaveAttribute('href', '/user-agreement')
  expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
    'href',
    '/privacy-policy'
  )
})

it('shows no legal notice when no document is published', async () => {
  renderAuthRoute({ url: '/sign-in', status: github })

  await screen.findByRole('button', { name: 'Continue with GitHub' })
  expect(
    screen.queryByText(/By continuing, you agree to the/)
  ).not.toBeInTheDocument()
})
