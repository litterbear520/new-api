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
import { useMemo, useState } from 'react'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { SKILLS, skillById } from '../../data/skills'
import type { Skill } from '../../types'

/** Built-in skills first, then the user's own (imported or written here). */
export function useAllSkills(): Skill[] {
  const mine = useBearDrawStore((s) => s.mySkills)
  return useMemo(
    () => [
      ...SKILLS,
      ...mine.map((s): Skill => ({ ...s, mine: true, category: 'mine' })),
    ],
    [mine]
  )
}

/** One skill by id, built-in or the user's own. */
export function useSkill(id: string | null | undefined): Skill | null {
  const mine = useBearDrawStore((s) =>
    id ? s.mySkills.find((x) => x.id === id) : undefined
  )
  return useMemo<Skill | null>(() => {
    if (!id) return null
    if (mine) return { ...mine, mine: true, category: 'mine' }
    return skillById(id) ?? null
  }, [id, mine])
}

/** The last value that was not null, so a closing dialog keeps its content. */
export function useKept<T>(value: T | null): T | null {
  const [kept, setKept] = useState(value)
  if (value != null && value !== kept) setKept(value)
  return value ?? kept
}
