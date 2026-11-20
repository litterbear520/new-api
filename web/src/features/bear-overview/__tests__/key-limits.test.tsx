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
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { KeyLimits } from '../components/key-limits'

async function renderLimits(refreshing: boolean, onRefresh = vi.fn()) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <KeyLimits
          rows={[]}
          loading={false}
          updatedAt={Date.now()}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  return onRefresh
}

describe('key limits', () => {
  it('keeps the refresh button focusable while it refreshes, and ignores presses', async () => {
    const user = userEvent.setup()
    const onRefresh = await renderLimits(true)
    const refresh = await screen.findByRole('button', { name: 'Refresh' })

    refresh.focus()
    await user.keyboard('{Enter}')

    expect(refresh).toHaveAttribute('aria-disabled', 'true')
    expect(refresh).not.toBeDisabled()
    expect(refresh).toHaveFocus()
    expect(onRefresh).not.toHaveBeenCalled()
  })
})
