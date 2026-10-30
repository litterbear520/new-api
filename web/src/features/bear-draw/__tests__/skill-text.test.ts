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

import { LICENSE_FILES, SKILL_CREDITS } from '../data/credits'
import { SKILLS } from '../data/skills'
import {
  loadLicenseText,
  loadSkillReferences,
  loadSkillText,
  parseFrontmatter,
} from '../lib/skill-text'

describe('loadSkillText', () => {
  test('every built-in skill has its SKILL.md, named after the skill id', async () => {
    expect(SKILLS).toHaveLength(12)
    for (const skill of SKILLS) {
      const text = await loadSkillText(skill.id)
      const fm = parseFrontmatter(text ?? '')
      expect(fm.name).toBe(skill.id)
      expect(fm.description).toBeTruthy()
      expect(fm.body.startsWith('# ')).toBe(true)
    }
  })

  test('an id that is not built in gives null', async () => {
    expect(await loadSkillText('mine-poster-abc123')).toBeNull()
    expect(await loadSkillText('__proto__')).toBeNull()
  })
})

describe('loadSkillReferences', () => {
  test('returns the notes under the paths the SKILL.md names', async () => {
    const skill = (await loadSkillText('brand-vi')) ?? ''
    const refs = await loadSkillReferences('brand-vi')
    expect(refs.map((r) => r.path)).toEqual([
      'references/visual-modes.md',
      'references/theme-presets.md',
    ])
    for (const r of refs) {
      expect(skill).toContain(r.path)
      expect(r.text.length).toBeGreaterThan(1000)
    }
  })

  test('a skill without notes gives an empty list', async () => {
    expect(await loadSkillReferences('taobao-main-set')).toEqual([])
  })
})

describe('loadLicenseText', () => {
  test('every licence file the credits name loads', async () => {
    const named = new Set(SKILL_CREDITS.flatMap((c) => c.licenseFiles))
    expect([...named].sort()).toEqual([...LICENSE_FILES].sort())
    for (const file of LICENSE_FILES) {
      expect(await loadLicenseText(file)).toMatch(
        /License|Permission is hereby granted/
      )
    }
  })
})

describe('parseFrontmatter', () => {
  test('reads name and description and returns the text after the header', () => {
    const fm = parseFrontmatter(
      '---\nname: my-poster\ndescription: 做海报用\nlicense: MIT\n---\n\n# 海报\n正文'
    )
    expect(fm).toEqual({
      name: 'my-poster',
      description: '做海报用',
      body: '# 海报\n正文',
    })
  })

  test('quoted values and folded descriptions read as plain text', () => {
    const fm = parseFrontmatter(
      '---\nname: "a: b"\ndescription: >-\n  Line one\n  line two.\n\n  Second part.\nmetadata:\n  author: x\n---\nbody'
    )
    expect(fm.name).toBe('a: b')
    expect(fm.description).toBe('Line one line two.\nSecond part.')
  })

  test('a literal block keeps its line breaks', () => {
    const fm = parseFrontmatter('---\ndescription: |\n  one\n  two\n---\n')
    expect(fm.description).toBe('one\ntwo')
    expect(fm.body).toBe('')
  })

  test('a BOM and Windows line ends are handled', () => {
    const fm = parseFrontmatter('﻿---\r\nname: x\r\n---\r\nbody\r\n')
    expect(fm).toEqual({ name: 'x', body: 'body\n' })
  })

  test('without a closed header the whole text is the body', () => {
    expect(parseFrontmatter('# Title\ntext')).toEqual({ body: '# Title\ntext' })
    expect(parseFrontmatter('---\nname: x\nno end')).toEqual({
      body: '---\nname: x\nno end',
    })
  })
})
