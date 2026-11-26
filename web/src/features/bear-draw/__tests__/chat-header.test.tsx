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
import { describe, expect, test, vi } from 'vitest'

import { ChatHeader } from '../components/project/chat-header'
import type { Project, ProjectLayout } from '../types'

vi.mock('../components/project/title-menu', () => ({
  TitleMenu: () => null,
}))
vi.mock('../components/project/use-project-nav', () => ({
  useProjectNav: () => ({ home: vi.fn(), open: vi.fn() }),
}))

const project = {
  id: 'p1',
  title: 'Mugs',
  cost: 0,
  nodes: [{ status: 'ready' }, { status: 'ready' }, { status: 'failed' }],
} as unknown as Project

function header(layout: ProjectLayout, narrow = false) {
  const onLayout = vi.fn()
  render(
    <ChatHeader
      project={project}
      layout={layout}
      narrow={narrow}
      onLayout={onLayout}
    />
  )
  return onLayout
}

describe('the 画布 button at the top of the chat', () => {
  test('canvas closed: one labelled button with the number of pictures opens it', async () => {
    const onLayout = header('chat')
    const canvas = screen.getByRole('button', { name: 'Show the canvas' })
    expect(canvas).toHaveTextContent('Canvas')
    expect(canvas).toHaveTextContent('2')
    expect(canvas).toHaveAttribute('aria-pressed', 'false')
    // nothing to fold the chat for while the canvas is closed
    expect(screen.queryByRole('button', { name: 'Hide the chat' })).toBeNull()

    await userEvent.click(canvas)
    expect(onLayout).toHaveBeenCalledWith('split')
  })

  test('canvas open: the button closes it, and 收起对话 is there', async () => {
    const onLayout = header('split')
    const canvas = screen.getByRole('button', { name: 'Hide the canvas' })
    expect(canvas).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(canvas)
    expect(onLayout).toHaveBeenCalledWith('chat')
    await userEvent.click(screen.getByRole('button', { name: 'Hide the chat' }))
    expect(onLayout).toHaveBeenCalledWith('canvas')
  })

  test('narrow card: the button brings the canvas sheet', async () => {
    const onLayout = header('chat', true)
    await userEvent.click(
      screen.getByRole('button', { name: 'Show the canvas' })
    )
    expect(onLayout).toHaveBeenCalledWith('canvas')
  })
})
