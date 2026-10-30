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
import { describe, expect, it } from 'vitest'

import {
  hasSlots,
  parseTemplate,
  promptSnippet,
  templateText,
} from '../components/gallery/prompt-template'

const TEMPLATE =
  '一位 {argument name="hair color" default="金色"} 头发的女孩，{argument name="eye color" default="绿色"}眼睛'

describe('parseTemplate', () => {
  it('splits the template into text and slots with their defaults', () => {
    expect(parseTemplate(TEMPLATE)).toEqual([
      { kind: 'text', at: 0, text: '一位 ' },
      { kind: 'slot', at: 3, name: 'hair color', value: '金色' },
      { kind: 'text', at: 44, text: ' 头发的女孩，' },
      { kind: 'slot', at: 51, name: 'eye color', value: '绿色' },
      { kind: 'text', at: 91, text: '眼睛' },
    ])
  })

  it('keeps a prompt without slots as one text part', () => {
    const parts = parseTemplate('一只猫')
    expect(parts).toEqual([{ kind: 'text', at: 0, text: '一只猫' }])
    expect(hasSlots(parts)).toBe(false)
  })

  it('reads a slot with an empty default as an empty value', () => {
    const parts = parseTemplate('{argument name="x" default=""}!')
    expect(parts[0]).toEqual({ kind: 'slot', at: 0, name: 'x', value: '' })
    expect(templateText(parts)).toBe('!')
  })
})

describe('templateText', () => {
  it('fills every slot with its default', () => {
    expect(templateText(parseTemplate(TEMPLATE))).toBe(
      '一位 金色 头发的女孩，绿色眼睛'
    )
  })
})

describe('promptSnippet', () => {
  it('drops JSON punctuation and squeezes spaces for the card hover', () => {
    expect(promptSnippet('{"scene": "night\n  city"}')).toBe(
      'scene : night city'
    )
  })

  it('cuts long prompts to the given length', () => {
    expect(promptSnippet('a'.repeat(300), 120)).toHaveLength(120)
  })
})
