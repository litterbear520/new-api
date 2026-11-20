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

import { UserTurnView } from '../components/user-turn'
import type { UserTurn } from '../types'

const turn: UserTurn = { id: 'u1', role: 'user', text: 'Hello', at: 1 }

function startEditing() {
  render(<UserTurnView turn={turn} busy={false} onCopied={() => undefined} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  return screen.getByRole('textbox', { name: 'Edit message' })
}

describe('editing a sent message', () => {
  test('Esc that closes the IME candidates keeps the edit open', () => {
    const box = startEditing()
    fireEvent.keyDown(box, { key: 'Escape', isComposing: true })
    expect(box).toBeInTheDocument()
  })

  test('Esc that Safari marks with keyCode 229 keeps the edit open', () => {
    const box = startEditing()
    fireEvent.keyDown(box, { key: 'Escape', keyCode: 229 })
    expect(box).toBeInTheDocument()
  })

  test('a plain Esc leaves the edit', () => {
    const box = startEditing()
    fireEvent.keyDown(box, { key: 'Escape', keyCode: 27 })
    expect(box).not.toBeInTheDocument()
  })
})
