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
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { AccessPanel } from '../components/access-panel'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const LINES = [
  { url: 'https://api.example.com', route: 'Main', description: '' },
  { url: 'https://asia.example.com', route: 'Asia', description: '' },
]

// What New API returns for GET /v1/models without a key
function relayUnauthorized() {
  return new Response(
    JSON.stringify({ error: { message: 'Invalid token', type: 'x' } }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    relayUnauthorized()
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderPanel() {
  return render(
    <AccessPanel
      lines={LINES}
      line={LINES[0].url}
      onLine={vi.fn()}
      format='openai'
      onFormat={vi.fn()}
      apiKey={{ id: 5, name: 'Default', masked: 'sk-abcd**********wxyz' }}
      folded={false}
    />
  )
}

/** A key request the test answers when it wants. */
function slowKey() {
  let answer: (key: string) => void = () => undefined
  vi.spyOn(api, 'post').mockReturnValue(
    new Promise((resolve) => {
      answer = (key) => resolve({ data: { success: true, data: { key } } })
    })
  )
  return (key: string) => act(() => answer(key))
}

describe('connection details', () => {
  it('keeps the copy key button usable while the key is on its way', async () => {
    const user = userEvent.setup()
    slowKey()
    renderPanel()
    const copy = screen.getByRole('button', { name: 'Copy key' })

    await user.click(copy)

    expect(copy).not.toBeDisabled()
    expect(copy).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('says Copied in a status region when the key has been copied', async () => {
    const user = userEvent.setup()
    const answer = slowKey()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Copy key' }))
    await answer('abc')

    const status = await screen.findByText('Copied', { selector: 'p' })
    expect(status).toHaveAttribute('role', 'status')
    expect(await navigator.clipboard.readText()).toBe('sk-abc')
  })

  it('says Copy failed in a status region when the key cannot be fetched', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: false, message: 'busy' },
    })
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Copy key' }))

    const status = await screen.findByText('Copy failed')
    expect(status).toHaveAttribute('role', 'status')
  })

  it('keeps refresh focusable while it tests, then says the result of the test the user asked for', async () => {
    const user = userEvent.setup()
    renderPanel()
    // The first test runs by itself and is not read out.
    expect(await screen.findAllByText(/^\d+ ms$/)).toHaveLength(2)
    expect(screen.queryByText(/^Latency test done/)).not.toBeInTheDocument()

    const refresh = screen.getByRole('button', { name: 'Refresh' })
    refresh.focus()
    await user.keyboard('{Enter}')

    expect(refresh).toHaveFocus()
    expect(refresh).not.toBeDisabled()
    const summary = await screen.findByText(
      /^Latency test done\. Fastest: \d+ ms$/
    )
    expect(summary).toHaveAttribute('role', 'status')
  })
})
