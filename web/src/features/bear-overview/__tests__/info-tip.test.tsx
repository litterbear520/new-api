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
import { describe, expect, it } from 'vitest'

import { InfoTip } from '../components/info-tip'

const TEXT = 'Today is still running, so its bar is lighter.'

describe('info tip', () => {
  it('shows its text when the ⓘ is tapped', async () => {
    const user = userEvent.setup()
    render(<InfoTip text={TEXT} />)

    await user.click(screen.getByRole('button', { name: `About: ${TEXT}` }))

    expect(
      await screen.findByRole('dialog', { name: 'Tip' })
    ).toHaveTextContent(TEXT)
  })

  it('shows its text when Enter is pressed on the focused ⓘ', async () => {
    const user = userEvent.setup()
    render(<InfoTip text={TEXT} />)

    await user.tab()
    const trigger = screen.getByRole('button', { name: `About: ${TEXT}` })
    expect(trigger).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(
      await screen.findByRole('dialog', { name: 'Tip' })
    ).toHaveTextContent(TEXT)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })
})
