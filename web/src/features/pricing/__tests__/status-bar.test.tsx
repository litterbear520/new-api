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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ModelStatusBar } from '../components/model-status-bar'

const END = Date.parse('2026-09-07T12:00:00.000Z') / 1000
const SERIES = [
  { ts: END, success_rate: 100 },
  { ts: END - 3 * 3600, success_rate: 0 },
]

describe('model status bar', () => {
  it('lists every hour with its success rate after a tap on the strip', async () => {
    const user = userEvent.setup()
    render(<ModelStatusBar series={SERIES} windowEnd={END} />)
    await user.click(
      screen.getByRole('button', { name: 'Status, last 24 hours' })
    )
    const details = await screen.findByRole('dialog', {
      name: 'Status, last 24 hours',
    })
    const hours = within(details).getAllByRole('listitem')
    expect(hours).toHaveLength(24)
    expect(hours[23]).toHaveTextContent(/\d{2}:\d{2}.*100%/)
    expect(hours[20]).toHaveTextContent(/\d{2}:\d{2}.*0%/)
    expect(hours[22]).toHaveTextContent('No requests')
  })

  it('opens the hour details from the keyboard', async () => {
    const user = userEvent.setup()
    render(<ModelStatusBar series={SERIES} windowEnd={END} />)
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Status, last 24 hours' })
    ).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(
      await screen.findByRole('dialog', { name: 'Status, last 24 hours' })
    ).toBeVisible()
  })

  it('names an idle strip and still opens its empty hours', async () => {
    const user = userEvent.setup()
    render(<ModelStatusBar />)
    await user.click(
      screen.getByRole('button', { name: 'No requests in the last 24 hours' })
    )
    const details = await screen.findByRole('dialog', {
      name: 'No requests in the last 24 hours',
    })
    for (const hour of within(details).getAllByRole('listitem')) {
      expect(hour).toHaveTextContent('No requests')
    }
  })

  it('sits above the card link, so a tap opens the details instead of the model page', () => {
    render(<ModelStatusBar series={SERIES} windowEnd={END} />)
    expect(
      screen.getByRole('button', { name: 'Status, last 24 hours' })
    ).toHaveClass('relative', 'z-10')
  })
})
