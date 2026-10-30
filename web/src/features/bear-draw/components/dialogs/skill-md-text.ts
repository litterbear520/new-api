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
import { parseFrontmatter } from '../../lib/skill-text'

/*
 * A skill written in the 「新建技能」 dialog is saved as a SKILL.md: YAML
 * front matter with name and description, then the instructions. Same
 * format as Claude Code and Codex skills, so it can be taken elsewhere.
 */

/** One-line YAML scalar, quoted only when YAML would misread it. */
export function yamlValue(value: string): string {
  const v = value.replaceAll(/\s+/g, ' ').trim()
  const risky =
    v === '' ||
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(v) ||
    v.includes(': ') ||
    v.includes(' #') ||
    v.endsWith(':')
  if (!risky) return v
  if (!v.includes("'")) return `'${v}'`
  return JSON.stringify(v)
}

export type SkillDraft = {
  name: string
  description: string
  instructions: string
}

export function buildSkillMd(draft: SkillDraft): string {
  // instructions pasted with their own header keep only the text after it
  const body = parseFrontmatter(draft.instructions).body.trim()
  return [
    '---',
    `name: ${yamlValue(draft.name)}`,
    `description: ${yamlValue(draft.description)}`,
    '---',
    '',
    body,
    '',
  ].join('\n')
}
