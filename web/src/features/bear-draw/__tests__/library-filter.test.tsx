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
  filterSkills,
  libraryCategory,
  libraryTab,
  type SkillFilter,
} from '../components/library/skill-filter'
import type { Skill } from '../types'

const skill = (
  id: string,
  category: Skill['category'],
  extra: Partial<Skill> = {}
): Skill => ({
  id,
  name: id,
  tagline: '',
  description: '',
  category,
  platforms: [],
  author: '',
  starters: [],
  questions: [],
  deliverables: [],
  covers: [],
  sources: [],
  ...extra,
})

const SKILLS = [
  skill('taobao', 'ecom', {
    name: '淘宝主图套图',
    platforms: ['淘宝', '天猫'],
  }),
  skill('xhs', 'social', { name: '小红书封面', tagline: '3:4 大字封面' }),
  skill('logo', 'brand', { description: 'Logo directions and mockups' }),
  skill('mine-1', 'mine', { name: '我的海报', mine: true }),
]

const ids = (list: Skill[]) => list.map((s) => s.id)
const base: SkillFilter = {
  tab: 'explore',
  category: 'all',
  query: '',
  favorites: [],
}

describe('libraryTab and libraryCategory', () => {
  it('reads fav and mine as tabs and anything else as explore', () => {
    expect(['fav', 'mine', 'ecom', undefined].map(libraryTab)).toEqual([
      'fav',
      'mine',
      'explore',
      'explore',
    ])
  })

  it('reads a known category id as the explore filter', () => {
    const cats = ['ecom', 'brand']
    expect(libraryCategory('ecom', cats)).toBe('ecom')
    expect(libraryCategory('fav', cats)).toBe('all')
    expect(libraryCategory(undefined, cats)).toBe('all')
  })
})

describe('filterSkills', () => {
  it('explores the built-in skills only, optionally one category', () => {
    expect(ids(filterSkills(SKILLS, base))).toEqual(['taobao', 'xhs', 'logo'])
    expect(ids(filterSkills(SKILLS, { ...base, category: 'social' }))).toEqual([
      'xhs',
    ])
  })

  it('shows the favourites, own skills included', () => {
    const filter = {
      ...base,
      tab: 'fav' as const,
      favorites: ['logo', 'mine-1'],
    }
    expect(ids(filterSkills(SKILLS, filter))).toEqual(['logo', 'mine-1'])
  })

  it('shows only the user’s own skills on the mine tab', () => {
    expect(ids(filterSkills(SKILLS, { ...base, tab: 'mine' }))).toEqual([
      'mine-1',
    ])
  })

  it('searches names, taglines, descriptions and platforms, ignoring case', () => {
    const find = (query: string) =>
      ids(filterSkills(SKILLS, { ...base, query }))
    expect(find('天猫')).toEqual(['taobao'])
    expect(find('大字')).toEqual(['xhs'])
    expect(find('MOCKUPS')).toEqual(['logo'])
    expect(find('  ')).toEqual(['taobao', 'xhs', 'logo'])
    expect(find('没有这个')).toEqual([])
  })
})
