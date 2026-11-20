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

import { useBearChatStore } from '@/stores/bear-chat-store'

import { Topbar } from '../components/topbar'

function renderTopbar() {
  return render(
    <Topbar
      artifacts={0}
      panelOpen={false}
      onTogglePanel={() => undefined}
      onNew={() => undefined}
    />
  )
}

const titleOf = () => useBearChatStore.getState().convs[0]?.title

async function startRename() {
  const user = userEvent.setup()
  renderTopbar()
  await user.click(screen.getByRole('button', { name: 'More' }))
  await user.click(screen.getByRole('menuitem', { name: 'Rename' }))
  const box = screen.getByRole('textbox', { name: 'Conversation name' })
  fireEvent.change(box, { target: { value: 'Trip notes' } })
  return box
}

describe('chat top bar', () => {
  beforeEach(() => {
    const now = Date.now()
    useBearChatStore.setState({
      convs: [
        {
          id: 'c1',
          title: 'Old title',
          createdAt: now,
          updatedAt: now,
          turns: [],
        },
      ],
      curId: 'c1',
      live: null,
    })
  })

  test('the title button is named with the title on screen', () => {
    renderTopbar()
    expect(
      screen.getByRole('button', { name: /Old title/ })
    ).toBeInTheDocument()
  })

  test('Enter that picks an IME candidate keeps renaming', async () => {
    const box = await startRename()
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 229 })
    expect(box).toBeInTheDocument()
    expect(titleOf()).toBe('Old title')
  })

  test('Esc that closes the IME candidates keeps the typed name', async () => {
    const box = await startRename()
    fireEvent.keyDown(box, { key: 'Escape', keyCode: 229, isComposing: true })
    expect(box).toBeInTheDocument()
  })

  test('a plain Enter saves the name', async () => {
    const box = await startRename()
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 13 })
    expect(box).not.toBeInTheDocument()
    expect(titleOf()).toBe('Trip notes')
  })
})
