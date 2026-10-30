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
import { CHAT_W, STORAGE_KEYS } from '../../constants'

/** Width of the chat next to the canvas, kept between CHAT_W.min and max. */
export function clampChatWidth(px: number): number {
  if (!Number.isFinite(px)) return CHAT_W.initial
  return Math.min(CHAT_W.max, Math.max(CHAT_W.min, Math.round(px)))
}

/** The width the user dragged to last time (this browser). */
export function readChatWidth(): number {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEYS.chatW))
    return saved > 0 ? clampChatWidth(saved) : CHAT_W.initial
  } catch {
    return CHAT_W.initial
  }
}

export function saveChatWidth(px: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.chatW, String(clampChatWidth(px)))
  } catch {
    // Private mode or full storage: the width lasts for this visit.
  }
}
