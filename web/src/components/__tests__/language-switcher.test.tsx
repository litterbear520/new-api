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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { LanguageSwitcher } from '@/components/language-switcher'
import { INTERFACE_LANGUAGE_OPTIONS } from '@/i18n/languages'

test('opening the language menu shows a marker beside each language', async () => {
  render(<LanguageSwitcher />)
  await userEvent.click(screen.getByRole('button', { name: 'Change language' }))

  const items = await screen.findAllByRole('menuitem')
  expect(
    items.map((item) => [
      item.querySelector('[data-flag]')?.getAttribute('data-flag'),
      item.querySelector('[data-flag]')?.nextSibling?.textContent,
    ])
  ).toEqual(INTERFACE_LANGUAGE_OPTIONS.map((lang) => [lang.code, lang.label]))
})

test('繁體中文 gets a neutral 繁 text badge instead of a regional flag', async () => {
  render(<LanguageSwitcher />)
  await userEvent.click(screen.getByRole('button', { name: 'Change language' }))

  const item = await screen.findByRole('menuitem', { name: '繁體中文' })
  const badge = item.querySelector('[data-flag="zhTW"]')
  expect(badge).toHaveTextContent('繁')
  expect(badge).toHaveAttribute('aria-hidden', 'true')
  expect(badge?.querySelector('svg')).toBeNull()
})
