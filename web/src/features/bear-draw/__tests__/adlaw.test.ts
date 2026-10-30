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
import { describe, expect, test } from 'vitest'

import { applyAdLawFixes, findAdLaw, findPromptAdLaw } from '../lib/adlaw'

const words = (text: string) => findAdLaw(text).map((m) => m.word)

describe('findAdLaw', () => {
  test('plain Chinese copy: flags a superlative with the list wording and the law', () => {
    const [hit, ...rest] = findAdLaw('最好用的保温杯')
    expect(rest).toEqual([])
    expect(hit.word).toBe('最好')
    expect(hit.fix).toBe('很好')
    expect(hit.reason).toContain('《广告法》第九条第（三）项')
  })

  test('prompt with quotes: checks only the quoted copy, not the instructions', () => {
    const prompt =
      'Keep the bottle 完全一致 with the reference. Text (verbatim): "全网第一" top-left; no other text.'
    expect(findAdLaw(prompt)).toEqual([
      expect.objectContaining({ word: '第一', fix: '热销' }),
    ])
  })

  test('every quote style counts as copy', () => {
    const prompt = '「顶级面料」 “永久保修” 『招财进宝』 "跳楼价 99"'
    expect(words(prompt)).toEqual(['顶级', '永久', '招财进宝', '跳楼价'])
  })

  test('a stray inch mark does not swallow the copy that follows', () => {
    expect(words('a 5" tall bottle with "最佳搭档" on the label')).toEqual([
      '最佳',
    ])
  })

  test('time words after 最 and ordinal 第一 are not flagged', () => {
    expect(
      findAdLaw(
        '"最近上新，最后一天，每人最多 2 件，第一次用，冬天的第一杯奶茶"'
      )
    ).toEqual([])
  })

  test('any other 最 word is flagged by its 最 alone', () => {
    expect(findAdLaw('"最美的你"')).toEqual([
      expect.objectContaining({ word: '最', fix: '' }),
    ])
  })

  test('the longest listed word wins', () => {
    expect(findAdLaw('"全网最低价 ¥99"')).toEqual([
      expect.objectContaining({ word: '全网最低价', fix: '到手价' }),
    ])
  })

  test('words that are legal with proof are not flagged', () => {
    expect(findAdLaw('"原价 199，限时 3 天，销量 10 万+，已通过检测"')).toEqual(
      []
    )
  })

  test('保证金 is not a guarantee', () => {
    expect(words('"保证金 100 元"')).toEqual([])
    expect(words('"保证正品"')).toEqual(['保证'])
  })

  test('No.1 and TOP1 match in any case and spacing', () => {
    expect(words('"销量No.1 · top 1 好物"')).toEqual(['No.1', 'top 1'])
  })

  test('a suggestion that starts with 有 is still a replacement', () => {
    expect(findAdLaw('"独一无二的设计"')).toEqual([
      expect.objectContaining({ word: '独一无二', fix: '有辨识度' }),
    ])
  })

  test('a repeated word is listed once', () => {
    expect(words('"最好的杯 最好的壶"')).toEqual(['最好'])
  })
})

describe('applyAdLawFixes', () => {
  test('replaces the found words inside the quotes only', () => {
    const prompt = 'Keep the 第一 layout. Text: "全网第一，最好用"'
    expect(applyAdLawFixes(prompt, findAdLaw(prompt))).toBe(
      'Keep the 第一 layout. Text: "全网热销，很好用"'
    )
  })

  test('a deleted word leaves no double space', () => {
    const prompt = 'Text: "No.1 Choice" and "百分百 好评"'
    expect(applyAdLawFixes(prompt, findAdLaw(prompt))).toBe(
      'Text: "Choice" and "好评"'
    )
  })

  test('only the words passed in are replaced', () => {
    const prompt = '"顶级面料，最好用"'
    const [, best] = findAdLaw(prompt)
    expect(applyAdLawFixes(prompt, [best])).toBe('"顶级面料，很好用"')
  })

  test('the 最 rule deletes only the 最 and keeps 最近', () => {
    const prompt = '"最近最美的季节"'
    expect(applyAdLawFixes(prompt, findAdLaw(prompt))).toBe('"最近美的季节"')
  })

  test('an empty list leaves the text unchanged', () => {
    expect(applyAdLawFixes('"最好用"', [])).toBe('"最好用"')
  })
})

describe('findPromptAdLaw', () => {
  test('mood words in a prompt without picture text are not flagged', () => {
    expect(
      findPromptAdLaw(
        'Watercolor picture-book style, 治愈 and cosy, a bear fishing under the moon'
      )
    ).toEqual([])
  })

  test('the Text (verbatim) line counts as picture text', () => {
    const hits = findPromptAdLaw(
      'Product shot.\nText (verbatim): 全网第一 保温杯\nAvoid: clutter'
    )
    expect(hits.map((h) => h.word)).toContain('第一')
  })

  test('a Text line that says none adds nothing', () => {
    expect(findPromptAdLaw('Scene: desk\nText (verbatim): none')).toEqual([])
  })

  test('quoted copy is still checked', () => {
    expect(
      findPromptAdLaw('Badge reads 「最好用」 in red').length
    ).toBeGreaterThan(0)
  })
})
