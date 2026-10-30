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
import { MARK_NUMBERS, RATIO_HINT } from '../constants'
import type { DrawRequest } from '../types'

/**
 * The prompt sent upstream. The size parameter is ignored upstream, so the
 * ratio goes into the words. Circled edits send the picture plus a copy with
 * red numbered circles, because the mask parameter is ignored as well.
 */
export function buildPrompt(req: DrawRequest): string {
  const parts: string[] = []
  const hasBase = req.imgs.some((img) => img.kind === 'base')
  const hasMark = req.imgs.some((img) => img.kind === 'mark')
  const refs = req.imgs.filter((img) => img.kind === 'ref').length

  if (hasBase && hasMark) {
    parts.push(
      'Edit image 1. Image 2 is the same picture with red numbered circles that mark where to change; it is only a guide.',
      `Change only inside the marked areas: ${req.text}`,
      'Keep everything else in image 1 exactly the same. Do not draw the red circles or numbers in the result.'
    )
    if (refs > 0) {
      parts.push('The images after image 2 are references.')
    }
  } else if (hasBase) {
    parts.push(
      refs > 0
        ? 'Edit image 1; the other images are references, numbered in the order given.'
        : 'Edit this picture.',
      req.text
    )
  } else if (refs > 1) {
    parts.push(
      'The images are references, numbered in the order given (image 1, image 2, …).',
      req.text
    )
  } else {
    parts.push(req.text)
  }

  const hint = RATIO_HINT[req.ratio]
  if (hint) parts.push(hint)
  if (req.clear) parts.push('Transparent background.')
  return parts.join('\n')
}

/** Short title for a new conversation, from its first description. */
export function titleFrom(text: string): string {
  const flat = text.replaceAll(/\s+/g, ' ').trim()
  return flat.length > 14 ? `${flat.slice(0, 14)}…` : flat
}

/** Ratio or transparency mentioned in a "↳" suggestion. */
export function suggestionOptions(text: string): {
  ratio?: 'port' | 'land'
  clear?: boolean
} {
  const out: { ratio?: 'port' | 'land'; clear?: boolean } = {}
  if (/竖版|豎版|portrait|vertical/i.test(text)) out.ratio = 'port'
  else if (/横版|橫版|landscape|horizontal/i.test(text)) out.ratio = 'land'
  if (/透明|transparent/i.test(text)) out.clear = true
  return out
}

/**
 * The part of a grey hint that Tab puts into the box: the quoted example at
 * the end of a placeholder, or a whole example phrase without its note in
 * brackets.
 */
export function fillableExample(hint: string): string {
  const quoted = hint.match(/[“「«"]\s*([^”」»"]+?)\s*[”」»"]\s*$/)
  if (quoted) return quoted[1]
  return hint.replace(/\s*[（(][^（()）]*[)）]\s*$/, '').trim()
}

/** ① 红格纹款: the label of one picture of a split request. */
export function partLabel(part: { i: number; title: string }) {
  const n = MARK_NUMBERS[part.i - 1] ?? `${part.i}.`
  return part.title ? `${n} ${part.title}` : n
}
