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
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'

import { useBearChatStore } from '@/stores/bear-chat-store'

import { ReplyAnnouncer } from '../components/reply-announcer'
import type { ReplyStatus } from '../types'

const live = {
  convId: 'c1',
  turnId: 'a1',
  replyId: 'r1',
  kind: 'send' as const,
}

function setStatus(status: ReplyStatus) {
  useBearChatStore.getState().updateConv('c1', (c) => ({
    ...c,
    turns: [
      {
        id: 'a1',
        role: 'assistant',
        cur: 0,
        replies: [{ id: 'r1', model: 'm', content: '', status, startedAt: 0 }],
      },
    ],
  }))
}

function renderAnnouncer() {
  render(<ReplyAnnouncer />)
  return screen.getByRole('status')
}

describe('reply announcer', () => {
  beforeEach(() => {
    useBearChatStore.setState({
      convs: [
        { id: 'c1', title: 'Chat', createdAt: 0, updatedAt: 0, turns: [] },
      ],
      curId: 'c1',
      live: null,
    })
    setStatus('waiting')
  })

  test('is in the page, empty, before any reply', () => {
    expect(renderAnnouncer()).toHaveTextContent('')
  })

  test('says once that a reply started, not each time it grows', () => {
    const region = renderAnnouncer()
    act(() => useBearChatStore.getState().setLive(live))
    expect(region).toHaveTextContent('Replying')
    const node = region.firstChild
    act(() => setStatus('streaming'))
    expect(region.firstChild).toBe(node)
  })

  test.each([
    ['done', 'Reply finished'],
    ['stopped', 'Reply stopped'],
    ['error', 'Reply failed'],
  ] as const)('says when a reply ends as %s', (status, words) => {
    const region = renderAnnouncer()
    act(() => useBearChatStore.getState().setLive(live))
    act(() => {
      setStatus(status)
      useBearChatStore.getState().setLive(null)
    })
    expect(region).toHaveTextContent(words)
  })
})
