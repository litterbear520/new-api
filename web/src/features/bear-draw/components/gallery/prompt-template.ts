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

/*
 * Some 玩法 prompts are templates with slots such as
 * {argument name="hair color" default="金色"}. The detail shows the default
 * highlighted, so people see which words to change.
 */

/** `at` is where the part starts in the template (a stable key). */
export type PromptPart =
  | { kind: 'text'; at: number; text: string }
  | { kind: 'slot'; at: number; name: string; value: string }

const SLOT = /\{argument name="([^"]+)" default="([^"]*)"\}/g

export function parseTemplate(template: string): PromptPart[] {
  const parts: PromptPart[] = []
  let last = 0
  for (const m of template.matchAll(SLOT)) {
    const at = m.index ?? 0
    if (at > last) {
      parts.push({ kind: 'text', at: last, text: template.slice(last, at) })
    }
    parts.push({ kind: 'slot', at, name: m[1], value: m[2] })
    last = at + m[0].length
  }
  if (last < template.length) {
    parts.push({ kind: 'text', at: last, text: template.slice(last) })
  }
  return parts
}

/** The prompt with every slot filled with its default. */
export function templateText(parts: readonly PromptPart[]): string {
  return parts.map((p) => (p.kind === 'text' ? p.text : p.value)).join('')
}

/** True when the template has at least one slot. */
export function hasSlots(parts: readonly PromptPart[]): boolean {
  return parts.some((p) => p.kind === 'slot')
}

/** One line of the prompt for the card's hover, without JSON noise. */
export function promptSnippet(prompt: string, max = 120): string {
  return prompt
    .replaceAll(/[{}"[\]]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
