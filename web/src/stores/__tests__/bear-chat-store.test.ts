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
import { beforeEach, describe, expect, test } from 'vitest'

import { useBearChatStore } from '../bear-chat-store'

const live = {
  convId: 'c1',
  turnId: 'a1',
  replyId: 'r1',
  kind: 'send' as const,
}

describe('bear chat store init', () => {
  beforeEach(() => {
    useBearChatStore.setState({
      uid: null,
      loaded: false,
      draftSystem: '',
      live: null,
    })
  })

  test('another account starts without the last one’s draft and reply', () => {
    const s = useBearChatStore.getState()
    s.init(1, [])
    s.setDraftSystem('private notes of account 1')
    s.setLive(live)
    s.openPanel('art-1')

    s.init(2, [])
    const next = useBearChatStore.getState()
    expect(next.draftSystem).toBe('')
    expect(next.live).toBeNull()
    expect(next.panel.open).toBe(false)
    expect(next.panel.artId).toBeNull()
  })

  test('the same account keeps them', () => {
    const s = useBearChatStore.getState()
    s.init(1, [])
    s.setDraftSystem('still typing')
    s.setLive(live)

    s.init(1, [])
    expect(useBearChatStore.getState().draftSystem).toBe('still typing')
    expect(useBearChatStore.getState().live).toEqual(live)
  })
})
