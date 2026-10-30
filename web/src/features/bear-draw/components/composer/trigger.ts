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
import type { CanvasNode, Project, Skill } from '../../types'

/*
 * The composer's two pickers: "/" picks a skill, "@" a picture on the
 * canvas. A trigger is the "/word" or "@word" the caret is in. It may follow
 * Chinese text directly (「把@首图」), but not a Latin letter, a digit or a
 * URL character, so "50/50", "https://" or an e-mail address never open one.
 */

export type TriggerKind = 'skill' | 'ref'

export type Trigger = {
  kind: TriggerKind
  /** What was typed after the "/" or "@". */
  query: string
  /** Index of the "/" or "@". */
  start: number
  /** The caret. */
  end: number
}

/** Characters a trigger may not follow. */
const WORDY = /[\w.%+/:@-]$/
const TRIGGER = /(^|[^\w.%+/:@-])([/@])([^\s/@]*)$/

/** The trigger the caret is in, if any. */
export function findTrigger(value: string, caret: number): Trigger | null {
  const m = TRIGGER.exec(value.slice(0, caret))
  if (!m) return null
  const query = m[3]
  return {
    kind: m[2] === '/' ? 'skill' : 'ref',
    query,
    start: caret - query.length - 1,
    end: caret,
  }
}

/** Replaces the trigger word with `insert`; returns the text and the caret. */
export function replaceTrigger(
  value: string,
  trigger: Trigger,
  insert: string
): { value: string; caret: number } {
  return {
    value: value.slice(0, trigger.start) + insert + value.slice(trigger.end),
    caret: trigger.start + insert.length,
  }
}

/** Puts a "/" or "@" at the caret (after a space when it would not open). */
export function insertTrigger(
  value: string,
  caret: number,
  mark: '/' | '@'
): { value: string; caret: number } {
  const before = value.slice(0, caret)
  const add = WORDY.test(before) ? ` ${mark}` : mark
  return {
    value: before + add + value.slice(caret),
    caret: caret + add.length,
  }
}

/** Skills whose name, tagline or platforms contain the query. */
export function matchSkills(skills: Skill[], query: string): Skill[] {
  const q = query.trim().toLowerCase()
  if (!q) return skills
  return skills.filter((s) =>
    [s.name, s.tagline, ...s.platforms, s.id]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
}

export type CanvasPick = {
  node: CanvasNode
  /** The node's label, or "Picture n" when it has none. */
  label: string
  /** The frame it sits in. */
  group?: string
}

/** Finished pictures on the canvas whose label contains the query. */
export function matchCanvas(
  project: Project | null,
  query: string,
  fallbackLabel: (n: number) => string
): CanvasPick[] {
  if (!project) return []
  const q = query.trim().toLowerCase()
  const groups = new Map(project.groups.map((g) => [g.id, g.title]))
  return project.nodes
    .filter((n) => n.status === 'ready' && n.img)
    .map((node, i) => ({
      node,
      label: node.label.trim() || fallbackLabel(i + 1),
      group: node.groupId ? groups.get(node.groupId) : undefined,
    }))
    .filter((p) => !q || p.label.toLowerCase().includes(q))
}
