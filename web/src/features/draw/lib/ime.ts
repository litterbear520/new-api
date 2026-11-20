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

/**
 * True for a key that an IME (pinyin, kana and the like) still owns: Enter
 * picking a candidate, Esc closing the candidate list. Chrome flags these
 * with isComposing; Safari sends the Enter after compositionend, so only
 * keyCode 229 marks it there.
 */
export function imeOwnsKey(e: {
  isComposing: boolean
  keyCode: number
}): boolean {
  return e.isComposing || e.keyCode === 229
}
