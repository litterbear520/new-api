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
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useBearChatStore } from '@/stores/bear-chat-store'

import { BearChat } from '../index'
import { stopReply } from '../lib/run'

const stick = vi.hoisted(() => ({ isNearBottom: true }))

vi.mock('use-stick-to-bottom', () => ({
  useStickToBottom: () => ({
    scrollRef: () => undefined,
    contentRef: () => undefined,
    isNearBottom: stick.isNearBottom,
    scrollToBottom: vi.fn(),
  }),
}))

vi.mock('@/context/theme-provider', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: () => undefined }),
}))

vi.mock('@/features/draw/hooks/use-glass', () => ({
  useGlass: () => () => undefined,
  useGlassLight: () => undefined,
}))

vi.mock('../hooks/use-chat-persistence', () => ({
  useChatPersistence: () => 'ready',
}))

vi.mock('../hooks/use-chat-env', () => {
  const env = { models: [{ id: 'm' }], groups: [], loading: false }
  return { useChatEnv: () => env }
})

vi.mock('../hooks/use-bear', () => {
  const bear = { director: null, work: null, workSince: 0, stopped: false }
  return { useBear: () => bear }
})

vi.mock('../lib/run', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/run')>()),
  stopReply: vi.fn(),
}))

// the page's own parts; each has its own tests
vi.mock('../components/composer', () => ({
  Composer: () => <textarea className='bc-ta' aria-label='Message' />,
}))
vi.mock('../components/thread', () => ({ Thread: () => null }))
vi.mock('../components/topbar', () => ({ Topbar: () => null }))
vi.mock('../components/artifact-panel', () => ({ ArtifactPanel: () => null }))

const jump = () =>
  screen.getByRole('button', { name: 'Jump to the latest', hidden: true })

describe('chat page', () => {
  beforeEach(() => {
    stick.isNearBottom = true
    vi.mocked(stopReply).mockClear()
    useBearChatStore.setState({
      convs: [
        { id: 'c1', title: 'Chat', createdAt: 0, updatedAt: 0, turns: [] },
      ],
      curId: 'c1',
      live: { convId: 'c1', turnId: 'a1', replyId: 'r1', kind: 'send' },
    })
  })

  afterEach(() => {
    useBearChatStore.setState({ live: null })
  })

  test('Esc that closes the IME candidates does not stop the reply', () => {
    render(<BearChat />)
    const box = screen.getByRole('textbox')
    fireEvent.keyDown(box, { key: 'Escape', isComposing: true })
    fireEvent.keyDown(box, { key: 'Escape', keyCode: 229 })
    expect(stopReply).not.toHaveBeenCalled()
  })

  test('a plain Esc stops the reply', () => {
    render(<BearChat />)
    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Escape',
      keyCode: 27,
    })
    expect(stopReply).toHaveBeenCalledTimes(1)
  })

  test('at the newest message, "Jump to the latest" is out of Tab and screen readers', () => {
    render(<BearChat />)
    expect(jump()).toHaveAttribute('inert')
  })

  test('scrolled up, "Jump to the latest" can be reached', () => {
    stick.isNearBottom = false
    render(<BearChat />)
    expect(jump()).not.toHaveAttribute('inert')
  })

  test('used from the keyboard, it hands the focus to the message box', () => {
    stick.isNearBottom = false
    render(<BearChat />)
    fireEvent.click(jump(), { detail: 0 })
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  test('keeps a status region for reply announcements', () => {
    render(<BearChat />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
