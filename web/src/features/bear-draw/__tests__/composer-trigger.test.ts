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
  findTrigger,
  insertTrigger,
  replaceTrigger,
} from '../components/composer/trigger'

const at = (text: string) => findTrigger(text, text.length)

describe('findTrigger', () => {
  it('finds "/word" at the start and "@word" right after Chinese text', () => {
    expect(at('/淘宝')).toEqual({
      kind: 'skill',
      query: '淘宝',
      start: 0,
      end: 3,
    })
    expect(at('把@首')).toEqual({ kind: 'ref', query: '首', start: 1, end: 3 })
  })

  it('ignores slashes and at signs inside numbers, links and e-mail addresses', () => {
    expect(at('满 50/50')).toBeNull()
    expect(at('https://')).toBeNull()
    expect(at('me@example')).toBeNull()
  })

  it('ends at a space after the word', () => {
    expect(at('/海报 ')).toBeNull()
  })
})

describe('replaceTrigger', () => {
  it('swaps the word under the caret and keeps the rest of the text', () => {
    const text = '把@首 换成蓝色'
    const trigger = findTrigger(text, 3)
    expect(trigger).not.toBeNull()
    if (!trigger) return
    expect(replaceTrigger(text, trigger, '@首图 ')).toEqual({
      value: '把@首图  换成蓝色',
      caret: 5,
    })
  })
})

describe('insertTrigger', () => {
  it('adds a space only where the mark would not open the picker', () => {
    expect(insertTrigger('海报', 2, '/')).toEqual({ value: '海报/', caret: 3 })
    expect(insertTrigger('poster', 6, '/')).toEqual({
      value: 'poster /',
      caret: 8,
    })
  })
})
