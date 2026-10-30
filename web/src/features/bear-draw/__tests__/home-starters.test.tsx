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
  categoryStarters,
  dayPart,
  keyed,
  stripSkillPrefix,
} from '../components/home/home-text'
import type { Skill } from '../types'

const skill = (id: string, category: Skill['category'], starter?: string) =>
  ({
    id,
    name: id,
    tagline: '',
    description: '',
    category,
    platforms: [],
    author: '小熊API',
    starters: starter ? [starter] : [],
    questions: [],
    deliverables: [],
    covers: [],
    sources: [],
  }) satisfies Skill

describe('dayPart', () => {
  it('greets by the prototype hours: late, morning, noon, afternoon, evening', () => {
    expect([0, 5, 6, 10, 11, 13, 14, 17, 18, 23].map(dayPart)).toEqual([
      'late',
      'late',
      'morning',
      'morning',
      'noon',
      'noon',
      'afternoon',
      'afternoon',
      'evening',
      'evening',
    ])
  })
})

describe('stripSkillPrefix', () => {
  it('drops the 用「技能」 lead, since the chip names the skill', () => {
    expect(
      stripSkillPrefix('用「淘宝主图套图」给我的保温杯出一套 5 张主图')
    ).toBe('给我的保温杯出一套 5 张主图')
  })

  it('keeps lines that do not start with a skill', () => {
    expect(stripSkillPrefix('把这套主图改成拼多多 750×750 的版本')).toBe(
      '把这套主图改成拼多多 750×750 的版本'
    )
  })
})

describe('categoryStarters', () => {
  it('takes the first starter of the first three skills of the category', () => {
    const skills = [
      skill('a', 'ecom', '用「A」做主图'),
      skill('x', 'brand', '用「X」做 logo'),
      skill('b', 'ecom'),
      skill('c', 'ecom', '做详情页'),
      skill('d', 'ecom', '用「D」做白底'),
    ]
    const lines = categoryStarters(skills, 'ecom')
    expect(lines.map((l) => [l.skill.id, l.text])).toEqual([
      ['a', '做主图'],
      ['b', ''],
      ['c', '做详情页'],
    ])
  })
})

describe('keyed', () => {
  it('makes repeated texts unique keys in order', () => {
    expect(keyed(['a', 'b', 'a', 'a']).map((k) => k.key)).toEqual([
      'a',
      'b',
      'a#2',
      'a#3',
    ])
  })
})
