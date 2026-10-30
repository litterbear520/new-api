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
import type { Skill } from '../../types'

/*
 * The skills page keeps one search param, `tab`: empty for everything, a
 * category id (ecom, brand…) for one category, `fav` or `mine`.
 */

export type LibraryTab = 'explore' | 'fav' | 'mine'

export function libraryTab(tab: string | undefined): LibraryTab {
  if (tab === 'fav' || tab === 'mine') return tab
  return 'explore'
}

/** The category the explore tab shows, or 'all'. */
export function libraryCategory(
  tab: string | undefined,
  categories: readonly string[]
): string {
  return tab && categories.includes(tab) ? tab : 'all'
}

export type SkillFilter = {
  tab: LibraryTab
  category: string
  query: string
  favorites: readonly string[]
}

function matches(skill: Skill, query: string): boolean {
  const hay = [
    skill.name,
    skill.tagline,
    skill.description,
    skill.platforms.join(' '),
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(query.toLowerCase())
}

export function filterSkills(
  skills: readonly Skill[],
  filter: SkillFilter
): Skill[] {
  let list: Skill[]
  if (filter.tab === 'fav') {
    list = skills.filter((s) => filter.favorites.includes(s.id))
  } else if (filter.tab === 'mine') {
    list = skills.filter((s) => s.mine)
  } else {
    list = skills.filter((s) => !s.mine)
    if (filter.category !== 'all') {
      list = list.filter((s) => s.category === filter.category)
    }
  }
  const q = filter.query.trim()
  return q ? list.filter((s) => matches(s, q)) : list
}
