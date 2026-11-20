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
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { SidebarModulesCard } from '../components/sidebar-modules-card'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('sidebar settings card', () => {
  it('names each switch after its area or page and describes it with its line', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: {} },
    })
    render(<SidebarModulesCard />)

    const area = await screen.findByRole('switch', { name: 'Console Area' })
    expect(area).toHaveAccessibleDescription('Data management and log viewing')
    const page = screen.getByRole('switch', { name: 'Usage Logs' })
    expect(page).toHaveAccessibleDescription('API usage records')
  })
})
