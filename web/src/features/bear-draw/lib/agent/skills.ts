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
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { specsFor } from '../../data/platforms'
import { skillById } from '../../data/skills'
import type { Part, Skill } from '../../types'
import { addPart, editPart } from '../project-edit'
import { loadSkillText } from '../skill-text'

/*
 * load_skill: the skill's SKILL.md (bundled for built-in skills, stored for
 * the user's own) plus the size rules of its platforms, shown in the chat as
 * 「正在读技能」 → 「读完了技能」.
 */

export function findSkill(id: string): Skill | null {
  return (
    skillById(id) ??
    useBearDrawStore.getState().mySkills.find((s) => s.id === id) ??
    null
  )
}

async function skillText(skill: Skill): Promise<string | null> {
  if (skill.text) return skill.text
  return loadSkillText(skill.id)
}

/** Reads a skill for the planner and returns the tool result. */
export async function loadSkillForModel(
  projectId: string,
  messageId: string,
  skillId: string
): Promise<unknown> {
  const skill = findSkill(skillId)
  if (!skill) {
    return { error: `No skill called ${skillId}. Use an id from the list.` }
  }
  const status = addPart<Extract<Part, { type: 'status' }>>(
    projectId,
    messageId,
    {
      type: 'status',
      icon: 'book',
      text: {
        key: 'Reading the skill “{{name}}”…',
        params: { name: skill.name },
      },
      live: true,
    }
  )
  const text = await skillText(skill).catch(() => null)
  editPart(projectId, status.id, 'status', (x) => ({
    ...x,
    live: false,
    text: text
      ? { key: 'Read the skill · {{name}}', params: { name: skill.name } }
      : {
          key: 'Could not read the skill “{{name}}”',
          params: { name: skill.name },
        },
  }))
  if (!text) {
    return { error: 'The skill text could not be loaded; go on without it.' }
  }
  const specs = specsFor(skill.platforms)
  return {
    skill: skill.id,
    name: skill.name,
    text,
    ...(specs.length ? { platform_specs: specs } : {}),
  }
}
