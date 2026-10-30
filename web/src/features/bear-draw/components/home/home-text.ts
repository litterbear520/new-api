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

export type DayPart = 'late' | 'morning' | 'noon' | 'afternoon' | 'evening'

/** Part of the day for the greeting (the prototype's hours). */
export function dayPart(hour: number): DayPart {
  if (hour < 6) return 'late'
  if (hour < 11) return 'morning'
  if (hour < 14) return 'noon'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

/** Starter lines name their skill (用「淘宝主图套图」…); the chip shows it instead. */
const SKILL_PREFIX = /^用\s*「[^」]+」\s*/

export function stripSkillPrefix(text: string): string {
  return text.replace(SKILL_PREFIX, '').trim()
}

export type StarterLine = { skill: Skill; text: string }

/** The first starter of the first few skills in a category. */
export function categoryStarters(
  skills: readonly Skill[],
  category: string,
  max = 3
): StarterLine[] {
  return skills
    .filter((s) => s.category === category)
    .slice(0, max)
    .map((skill) => ({
      skill,
      text: stripSkillPrefix(skill.starters[0] ?? ''),
    }))
}

export type Keyed = { key: string; text: string }

/** Texts that may repeat, each with a unique key: "a", "a#2", "b". */
export function keyed(texts: readonly string[]): Keyed[] {
  const seen = new Map<string, number>()
  return texts.map((text) => {
    const n = (seen.get(text) ?? 0) + 1
    seen.set(text, n)
    return { key: n === 1 ? text : `${text}#${n}`, text }
  })
}
