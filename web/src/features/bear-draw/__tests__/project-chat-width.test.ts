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
import { afterEach, describe, expect, it } from 'vitest'

import {
  clampChatWidth,
  readChatWidth,
  saveChatWidth,
} from '../components/project/chat-width'
import { CHAT_W, STORAGE_KEYS } from '../constants'

afterEach(() => {
  localStorage.removeItem(STORAGE_KEYS.chatW)
})

describe('chat width next to the canvas', () => {
  it('keeps a dragged width between the narrowest and widest chat', () => {
    expect(clampChatWidth(CHAT_W.min - 200)).toBe(CHAT_W.min)
    expect(clampChatWidth(CHAT_W.max + 200)).toBe(CHAT_W.max)
    expect(clampChatWidth(433.6)).toBe(434)
  })

  it('remembers the last width in this browser', () => {
    saveChatWidth(480)

    expect(readChatWidth()).toBe(480)
  })

  it('starts at the default width when nothing usable was saved', () => {
    expect(readChatWidth()).toBe(CHAT_W.initial)

    localStorage.setItem(STORAGE_KEYS.chatW, 'wide')
    expect(readChatWidth()).toBe(CHAT_W.initial)
  })
})
