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
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'

import { useDrawStore } from '@/stores/draw-store'

import { RoomSwitcher } from '../components/room-switcher'
import type { DrawRoom } from '../types'

const room: DrawRoom = {
  id: 'r1',
  title: 'Old title',
  model: 'm',
  t: 1,
  msgs: [],
}

const titleOf = () => useDrawStore.getState().rooms[0]?.title

async function startRename() {
  const user = userEvent.setup()
  render(<RoomSwitcher room={room} />)
  await user.click(screen.getByRole('button', { name: /Old title/ }))
  await user.click(
    screen.getByRole('menuitem', { name: 'Rename this conversation' })
  )
  const box = screen.getByRole('textbox', { name: 'Conversation name' })
  fireEvent.change(box, { target: { value: 'Cats' } })
  return box
}

describe('classic draw rename', () => {
  beforeEach(() => {
    useDrawStore.setState({ rooms: [room], curId: room.id })
  })

  test('Enter that picks an IME candidate keeps renaming', async () => {
    const box = await startRename()
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 229 })
    expect(box).toBeInTheDocument()
    expect(titleOf()).toBe('Old title')
  })

  test('Esc that closes the IME candidates keeps renaming', async () => {
    const box = await startRename()
    fireEvent.keyDown(box, { key: 'Escape', isComposing: true })
    expect(box).toBeInTheDocument()
  })

  test('a plain Enter saves the name', async () => {
    const box = await startRename()
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 13 })
    expect(box).not.toBeInTheDocument()
    expect(titleOf()).toBe('Cats')
  })
})
