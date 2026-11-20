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
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { ThinkRow } from '../components/reply-parts'
import type { Reply } from '../types'

const reply: Reply = {
  id: 'r1',
  model: 'm',
  content: 'The answer',
  status: 'done',
  startedAt: 0,
  firstAt: 0,
  textAt: 6000,
}

function renderThinking() {
  render(<ThinkRow reply={reply} text='Long reasoning' live={false} />)
  const button = screen.getByRole('button', { name: /Thought for/ })
  const panel = screen.getByText('Long reasoning').closest('.bc-think-t')
  return { button, panel }
}

describe('folded thinking', () => {
  test('the button points at the text it folds', () => {
    const { button, panel } = renderThinking()
    expect(panel?.id).toBeTruthy()
    expect(button).toHaveAttribute('aria-controls', panel?.id)
  })

  test('folded, the text is inert: out of screen readers and find in page', () => {
    const { button, panel } = renderThinking()
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(panel).toHaveAttribute('inert')
  })

  test('unfolded, the text is back', () => {
    const { button, panel } = renderThinking()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(panel).not.toHaveAttribute('inert')
  })
})
