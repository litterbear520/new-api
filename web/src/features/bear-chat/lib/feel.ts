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
/*
 * Tiny guesses from what the user typed, only used to pick what the bear
 * does. Wrong guesses are harmless: the reply is the same either way.
 */

/** Longer messages are real requests, not just a thank-you. */
const SHORT = 40

export type Feel = 'heart' | 'shy'

export function feelOf(text: string): Feel | null {
  const t = text.trim()
  if (!t || t.length > SHORT) return null
  if (
    /谢谢|感谢|多谢|謝謝|感謝|thank|thx|ありがとう|merci|спасибо|cảm ơn/i.test(
      t
    )
  ) {
    return 'heart'
  }
  if (
    /厉害|真棒|好棒|太强|好聪明|你真好|牛|厲害|好強|amazing|awesome|great job|you rock|brilliant|すごい|génial|молодец|giỏi/i.test(
      t
    )
  ) {
    return 'shy'
  }
  return null
}

export type WorkHint = 'translate' | 'calc' | 'book' | 'read' | null

/** What the request is about, for the act while the reply is written. */
export function workOf(text: string, images: number): WorkHint {
  if (/翻译|翻成|譯|translate|traduire|перевед|dịch/i.test(text)) {
    return 'translate'
  }
  if (
    /多少钱|合计|总共|一共|算一下|计算|算算|多少錢|合計|總共|calculate|total cost|how much|sum of/i.test(
      text
    )
  ) {
    return 'calc'
  }
  if (images > 0) return 'read'
  if (text.length > 3000) return 'book'
  return null
}

/** Poems and lyrics: the bear hums once the reply is done. */
export function wantsSong(text: string): boolean {
  return /诗|詩|歌词|歌詞|唱|poem|lyrics|song|haiku|俳句|poème|стих/i.test(text)
}
