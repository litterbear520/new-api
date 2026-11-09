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
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'

import { ThemeToggle } from '@/components/theme-toggle'
import { ThemeProvider, useTheme } from '@/context/theme-provider'
import { THEME_STORAGE_KEYS } from '@/lib/theme-storage'
import { useNightSeaStore } from '@/stores/night-sea-store'

afterEach(() => {
  localStorage.clear()
  useNightSeaStore.setState({ found: false, on: false })
  document.documentElement.classList.remove('light', 'dark')
})

let setThemeFromElsewhere: (theme: 'light' | 'dark') => void

function Elsewhere() {
  setThemeFromElsewhere = useTheme().setTheme
  return null
}

function renderToggle() {
  render(
    <ThemeProvider>
      <ThemeToggle />
      <Elsewhere />
    </ThemeProvider>
  )
}

async function click(name: string) {
  await userEvent.click(await screen.findByRole('button', { name }))
}

const stored = () => localStorage.getItem(THEME_STORAGE_KEYS.mode)

test('follows the system theme until the button is clicked', () => {
  renderToggle()

  // The test setup reports a light system theme.
  expect(stored()).toBeNull()
  expect(document.documentElement).toHaveClass('light')
  expect(
    screen.getByRole('button', { name: 'Switch to dark theme' })
  ).toBeInTheDocument()
})

test('clicking switches to dark and back to light without a menu', async () => {
  renderToggle()

  await click('Switch to dark theme')
  await waitFor(() => expect(stored()).toBe('dark'))
  expect(document.documentElement).toHaveClass('dark')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()

  await click('Switch to light theme')
  await waitFor(() => expect(stored()).toBe('light'))
  expect(document.documentElement).toHaveClass('light')
})

test('once a meteor was caught, the night sea follows dark', async () => {
  act(() => useNightSeaStore.setState({ found: true }))
  renderToggle()

  await click('Switch to dark theme')
  await waitFor(() => expect(stored()).toBe('dark'))
  await click('Switch to night sea')
  await waitFor(() => expect(useNightSeaStore.getState().on).toBe(true))
  expect(stored()).toBe('dark')
  expect(document.documentElement).toHaveClass('dark')

  await click('Switch to light theme')
  await waitFor(() =>
    expect(useNightSeaStore.getState()).toMatchObject({
      found: true,
      on: false,
    })
  )
  expect(document.documentElement).toHaveClass('light')
})

test('the knob stays in the hand when the theme changes under it', async () => {
  renderToggle()
  const button = screen.getByRole('button', { name: 'Switch to dark theme' })
  button.getBoundingClientRect = () => ({ width: 62 }) as DOMRect
  const pointer = (type: string, clientX: number) =>
    button.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        button: 0,
        clientX,
      })
    )

  // light is the right-hand end: pull the knob past the middle
  pointer('pointerdown', 100)
  pointer('pointermove', 80)
  await waitFor(() => expect(stored()).toBe('dark'))
  await act(() => new Promise((resolve) => setTimeout(resolve, 60)))

  const knob = button.querySelector<HTMLElement>('.tsw-knob') as HTMLElement
  expect(button).toHaveAttribute('data-held')
  expect(Number.parseFloat(knob.style.translate)).toBeCloseTo(6, 0)

  // and it is still the reader's: back over the middle
  pointer('pointermove', 100)
  await waitFor(() => expect(stored()).toBe('light'))
  pointer('pointerup', 100)
})

test('a theme changed elsewhere shows on the switch and stays', async () => {
  renderToggle()
  const button = screen.getByRole('button', { name: 'Switch to dark theme' })

  act(() => setThemeFromElsewhere('dark'))

  await waitFor(() => expect(button).toHaveAttribute('data-look', 'dark'))
  expect(button).toHaveAccessibleName('Switch to light theme')
  expect(document.documentElement).toHaveClass('dark')
})
