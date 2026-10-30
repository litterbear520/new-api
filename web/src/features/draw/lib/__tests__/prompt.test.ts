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

import type { DrawRequest } from '../../types'
import {
  buildPrompt,
  fillableExample,
  suggestionOptions,
  titleFrom,
} from '../prompt'

const req = (patch: Partial<DrawRequest>): DrawRequest => ({
  text: '给小熊戴一顶红色毛线帽',
  imgs: [],
  ratio: 'auto',
  clear: false,
  model: 'gpt-image-2',
  marks: null,
  ...patch,
})

describe('buildPrompt', () => {
  test('a new picture with a ratio carries the ratio in words', () => {
    const prompt = buildPrompt(req({ ratio: 'land' }))
    expect(prompt).toContain('给小熊戴一顶红色毛线帽')
    expect(prompt).toContain('16:9')
  })

  test('a circled edit tells the model to change only the marked areas and not draw the circles', () => {
    const prompt = buildPrompt(
      req({
        imgs: [
          { id: 'a', w: 10, h: 10, kind: 'base' },
          { id: 'b', w: 10, h: 10, kind: 'mark' },
        ],
      })
    )
    expect(prompt).toContain(
      'Change only inside the marked areas: 给小熊戴一顶红色毛线帽'
    )
    expect(prompt).toContain('Do not draw the red circles')
  })

  test('auto ratio adds no ratio words', () => {
    expect(buildPrompt(req({}))).toBe('给小熊戴一顶红色毛线帽')
  })
})

describe('titleFrom', () => {
  test('long descriptions are cut to 14 characters with an ellipsis', () => {
    expect(titleFrom('一只小熊划着小木船，平静的夜海，柔和的月光')).toBe(
      '一只小熊划着小木船，平静的夜…'
    )
  })
})

describe('suggestionOptions', () => {
  test('a suggestion that asks for a portrait wallpaper switches the ratio', () => {
    expect(suggestionOptions('做成竖版手机壁纸')).toEqual({ ratio: 'port' })
    expect(suggestionOptions('做成透明背景贴纸')).toEqual({ clear: true })
  })
})

describe('fillableExample', () => {
  test('takes the quoted example from a placeholder', () => {
    expect(fillableExample('说说要怎么改这张，比如「背景换成白天」')).toBe(
      '背景换成白天'
    )
    expect(
      fillableExample(
        'Dites comment modifier celle-ci, par ex. « passer le fond en plein jour »'
      )
    ).toBe('passer le fond en plein jour')
  })

  test('drops the note in brackets from an example phrase', () => {
    expect(fillableExample('把我家的猫画成水彩风格（先粘贴照片）')).toBe(
      '把我家的猫画成水彩风格'
    )
  })
})
