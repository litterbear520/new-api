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
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'

import { ThemeToggle } from '@/components/theme-toggle'
import { ThemeProvider } from '@/context/theme-provider'
import { THEME_STORAGE_KEYS } from '@/lib/theme-storage'
import { useNightSeaStore } from '@/stores/night-sea-store'

afterEach(() => {
  localStorage.clear()
  useNightSeaStore.setState({ found: false, on: false })
  document.documentElement.classList.remove('light', 'dark')
})

function renderToggle() {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  )
}

function click(name: string) {
  return userEvent.click(screen.getByRole('button', { name }))
}

test('follows the system theme until the button is clicked', () => {
  renderToggle()

  // The test setup reports a light system theme.
  expect(localStorage.getItem(THEME_STORAGE_KEYS.mode)).toBeNull()
  expect(document.documentElement).toHaveClass('light')
  expect(
    screen.getByRole('button', { name: 'Switch to dark theme' })
  ).toBeInTheDocument()
})

test('clicking switches to dark and back to light without a menu', async () => {
  renderToggle()

  await click('Switch to dark theme')
  expect(localStorage.getItem(THEME_STORAGE_KEYS.mode)).toBe('dark')
  expect(document.documentElement).toHaveClass('dark')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()

  await click('Switch to light theme')
  expect(localStorage.getItem(THEME_STORAGE_KEYS.mode)).toBe('light')
  expect(document.documentElement).toHaveClass('light')
})

test('once a meteor was caught, the night sea follows dark', async () => {
  act(() => useNightSeaStore.setState({ found: true }))
  renderToggle()

  await click('Switch to dark theme')
  await click('Switch to night sea')
  expect(useNightSeaStore.getState().on).toBe(true)
  expect(localStorage.getItem(THEME_STORAGE_KEYS.mode)).toBe('dark')
  expect(document.documentElement).toHaveClass('dark')

  await click('Switch to light theme')
  expect(useNightSeaStore.getState()).toMatchObject({ found: true, on: false })
  expect(document.documentElement).toHaveClass('light')
})
