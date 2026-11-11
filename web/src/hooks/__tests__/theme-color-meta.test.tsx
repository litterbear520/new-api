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
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { ThemeProvider, useTheme } from '@/context/theme-provider'

function SwitchToDark() {
  const { setTheme } = useTheme()
  return (
    <button type='button' onClick={() => setTheme('dark')}>
      dark
    </button>
  )
}

function themeColor() {
  return document
    .querySelector("meta[name='theme-color']")
    ?.getAttribute('content')
}

let sheet: HTMLStyleElement

beforeEach(() => {
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  document.head.append(meta)
  // Stands in for bg-background on body and the theme colour variables.
  sheet = document.createElement('style')
  sheet.textContent = `
    body { background-color: rgb(255, 255, 255); }
    html.dark body { background-color: rgb(21, 21, 21); }
    html[data-theme-preset='ocean'] body { background-color: rgb(10, 20, 30); }
  `
  document.head.append(sheet)
})

afterEach(() => {
  document.querySelector("meta[name='theme-color']")?.remove()
  sheet.remove()
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.removeAttribute('data-theme-preset')
  window.localStorage.clear()
})

function renderTheme() {
  render(
    <ThemeProvider>
      <SwitchToDark />
    </ThemeProvider>
  )
}

test('paints the browser bar in the page background, as hex', async () => {
  renderTheme()

  await waitFor(() => expect(themeColor()).toBe('#ffffff'))
})

test('follows a switch to the dark theme', async () => {
  renderTheme()
  await waitFor(() => expect(themeColor()).toBe('#ffffff'))

  await userEvent.click(screen.getByRole('button', { name: 'dark' }))

  await waitFor(() => expect(themeColor()).toBe('#151515'))
})

test('follows a colour preset set on the page root', async () => {
  renderTheme()
  await waitFor(() => expect(themeColor()).toBe('#ffffff'))

  act(() => {
    document.documentElement.setAttribute('data-theme-preset', 'ocean')
  })

  await waitFor(() => expect(themeColor()).toBe('#0a141e'))
})

test('reads other colour notations off the GPU, once per colour', async () => {
  const getImageData = vi.fn(() => ({ data: [11, 12, 13, 255] }))
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(
      () =>
        ({
          clearRect: () => undefined,
          fillRect: () => undefined,
          getImageData,
        }) as unknown as RenderingContext
    )
  const computed = vi
    .spyOn(window, 'getComputedStyle')
    .mockImplementation(
      () => ({ backgroundColor: 'lab(20 1 2)' }) as CSSStyleDeclaration
    )
  try {
    renderTheme()
    await waitFor(() => expect(themeColor()).toBe('#0b0c0d'))

    act(() => {
      document.documentElement.setAttribute('data-theme-preset', 'ocean')
    })
    await new Promise((resolve) => setTimeout(resolve, 60))

    expect(getContext).toHaveBeenCalledTimes(1)
    expect(getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true })
    expect(getImageData).toHaveBeenCalledTimes(1)
  } finally {
    getContext.mockRestore()
    computed.mockRestore()
  }
})
