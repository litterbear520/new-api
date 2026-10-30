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
/** Narrowest the artifact panel gets, and the room the chat keeps beside it. */
export const PANEL_MIN = 360
export const CHAT_MIN = 360
/** Below this card width the panel covers the chat instead. */
export const NARROW_CARD = 820

/** The panel's width: what the user dragged, or half the card (at least 420). */
export function panelWidth(cardW: number, saved: number): number {
  const max = Math.max(PANEL_MIN, cardW - CHAT_MIN)
  if (saved > 0) return Math.min(Math.max(saved, PANEL_MIN), max)
  return Math.round(Math.min(Math.max(cardW * 0.5, 420), max))
}
