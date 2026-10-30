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

import { buildSkillMd, yamlValue } from '../components/dialogs/skill-md-text'
import { parseSkillMd } from '../lib/skill-import'

describe('yamlValue', () => {
  it('leaves plain one-line values unquoted', () => {
    expect(yamlValue('我家店铺的上新海报')).toBe('我家店铺的上新海报')
  })

  it('quotes values YAML would misread and folds line breaks', () => {
    expect(yamlValue('做海报: 双11')).toBe("'做海报: 双11'")
    expect(yamlValue("it's: here")).toBe('"it\'s: here"')
    expect(yamlValue('  第一行\n第二行 ')).toBe('第一行 第二行')
    expect(yamlValue('')).toBe("''")
  })
})

describe('buildSkillMd', () => {
  it('writes a SKILL.md that reads back with the same name and description', () => {
    const text = buildSkillMd({
      name: '上新海报: 双11',
      description: '给店铺做上新海报',
      instructions: '## 出哪几张\n1. 首图 1:1\n',
    })
    expect(text).toBe(
      "---\nname: '上新海报: 双11'\ndescription: 给店铺做上新海报\n---\n\n## 出哪几张\n1. 首图 1:1\n"
    )
    const skill = parseSkillMd(text)
    expect(skill.name).toBe('上新海报: 双11')
    expect(skill.description).toBe('给店铺做上新海报')
    expect(skill.mine).toBe(true)
  })

  it('drops a header pasted into the instructions (另存为 a built-in skill)', () => {
    const text = buildSkillMd({
      name: '主图（我的版本）',
      description: '',
      instructions:
        '---\nname: taobao-main-set\ndescription: old\n---\n\n# 主图\n正文',
    })
    expect(text).toBe(
      "---\nname: 主图（我的版本）\ndescription: ''\n---\n\n# 主图\n正文\n"
    )
    expect(parseSkillMd(text).name).toBe('主图（我的版本）')
  })
})
