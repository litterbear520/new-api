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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UserProfile } from '@/features/profile/types'
import { api } from '@/lib/api'

import { LanguageRow } from '../components/language-row'

const profile = {
  id: 7,
  username: 'alice',
  setting: JSON.stringify({ language: 'en' }),
} as UserProfile

afterEach(async () => {
  await i18next.changeLanguage('en')
  cleanup()
  vi.restoreAllMocks()
})

describe('interface language row', () => {
  it('names the language box after its row', () => {
    render(<LanguageRow profile={profile} onUpdate={vi.fn()} />)

    expect(
      screen.getByRole('combobox', { name: 'Interface Language' })
    ).toBeInTheDocument()
  })

  it('keeps the language box enabled and focused while a new language is saved', async () => {
    const user = userEvent.setup()
    // The save stays open for the whole test.
    vi.spyOn(api, 'put').mockReturnValue(new Promise(() => undefined))
    render(<LanguageRow profile={profile} onUpdate={vi.fn()} />)
    const box = screen.getByRole('combobox', { name: 'Interface Language' })

    await user.click(box)
    await user.click(screen.getByRole('option', { name: 'Français' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/user/self', {
        language: 'fr',
      })
    )
    expect(box).toBeEnabled()
    expect(box).toHaveFocus()
  })
})
