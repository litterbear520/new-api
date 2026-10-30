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

import { parseSkillMd } from '../lib/skill-import'

const MD = `---
name: my-poster-skill
description: 给小店做上新海报。先问清楚产品，再出两张。
---

# 上新海报

## 出哪几张
1. 主海报 3:4
`

describe('parseSkillMd', () => {
  test('a SKILL.md with a header becomes one of my skills', () => {
    const skill = parseSkillMd(MD)
    expect(skill).toMatchObject({
      name: 'my-poster-skill',
      description: '给小店做上新海报。先问清楚产品，再出两张。',
      tagline: '给小店做上新海报',
      category: 'mine',
      mine: true,
      text: MD,
      covers: [],
      deliverables: [],
      questions: [],
    })
    expect(skill.id).toMatch(/^mine-my-poster-skill-[a-z0-9]{6}$/)
  })

  test('two imports of the same file get different ids', () => {
    expect(parseSkillMd(MD).id).not.toBe(parseSkillMd(MD).id)
  })

  test('without a header: name from the # title, description from the first paragraph', () => {
    const skill = parseSkillMd(
      '# 我的海报\n\n> 说明\n\n做促销海报用，价格逐字。\n\n## 步骤\n'
    )
    expect(skill.name).toBe('我的海报')
    expect(skill.description).toBe('做促销海报用，价格逐字。')
    expect(skill.id).toMatch(/^mine-skill-[a-z0-9]{6}$/)
  })

  test('without a name or title: the folder name of SKILL.md', () => {
    expect(parseSkillMd('Just steps.', 'poster-kit/SKILL.md').name).toBe(
      'poster-kit'
    )
    expect(parseSkillMd('Just steps.', 'brand-board.md').name).toBe(
      'brand-board'
    )
  })

  test('empty text is refused', () => {
    expect(() => parseSkillMd(' \n ')).toThrow(
      'Not a SKILL.md: the file is empty'
    )
  })

  test('a binary file read as text is refused', () => {
    expect(() =>
      parseSkillMd('PK\u0003\u0004\u0000\u0000binary', 'a.zip')
    ).toThrow('Not a SKILL.md: it is not a text file')
  })

  test('a header that is never closed is refused', () => {
    expect(() => parseSkillMd('---\nname: x\n\n# Title\n')).toThrow(
      'Not a SKILL.md: the --- header at the top is not closed'
    )
  })

  test('a text with no name anywhere is refused', () => {
    expect(() => parseSkillMd('Just steps.', 'SKILL.md')).toThrow(
      'Not a SKILL.md: give it a name (name: in the --- header, or a # title)'
    )
  })

  test('a very large file is refused', () => {
    expect(() => parseSkillMd(`# Big\n${'x'.repeat(200_001)}`)).toThrow(
      'Not a SKILL.md: the file is larger than 200 KB'
    )
  })
})
