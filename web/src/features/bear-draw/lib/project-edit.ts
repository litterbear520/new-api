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
import { findProject, newId, useBearDrawStore } from '@/stores/bear-draw-store'

import type {
  AgentMessage,
  CanvasGroup,
  CanvasNode,
  Message,
  Part,
  ProgressItem,
  Project,
} from '../types'

/*
 * Small immutable edits of a project in the store, shared by the agent and
 * the picture queue. Every edit that changes what the user sees bumps
 * `updatedAt`, which also sorts the project to the top of the list.
 */

export function edit(projectId: string, fn: (p: Project) => Project) {
  useBearDrawStore.getState().updateProject(projectId, (p) => {
    const next = fn(p)
    return next === p ? p : { ...next, updatedAt: Date.now() }
  })
}

export function agentMessage(
  p: Project | null,
  messageId: string
): AgentMessage | null {
  const m = p?.messages.find((x) => x.id === messageId)
  return m?.role === 'agent' ? m : null
}

export function findPart(
  p: Project | null,
  partId: string
): { message: AgentMessage; part: Part } | null {
  for (const m of p?.messages ?? []) {
    if (m.role !== 'agent') continue
    const part = m.parts.find((x) => x.id === partId)
    if (part) return { message: m, part }
  }
  return null
}

export function editMessage(
  projectId: string,
  messageId: string,
  fn: (m: AgentMessage) => AgentMessage
) {
  edit(projectId, (p) => {
    let hit = false
    const messages = p.messages.map((m): Message => {
      if (m.id !== messageId || m.role !== 'agent') return m
      hit = true
      return fn(m)
    })
    return hit ? { ...p, messages } : p
  })
}

export function addMessage(projectId: string, message: Message) {
  edit(projectId, (p) => ({ ...p, messages: [...p.messages, message] }))
}

/** Omit over each member of a union (plain Omit keeps only the shared keys). */
export type DistOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

/** Appends a part to a message and returns it (with its new id). */
export function addPart<T extends Part = Part>(
  projectId: string,
  messageId: string,
  part: DistOmit<T, 'id'>
): T {
  const full = { ...part, id: newId('pt') } as unknown as T
  editMessage(projectId, messageId, (m) => ({
    ...m,
    parts: [...m.parts, full],
  }))
  return full
}

export function editPart<T extends Part['type']>(
  projectId: string,
  partId: string,
  type: T,
  fn: (part: Extract<Part, { type: T }>) => Extract<Part, { type: T }>
) {
  edit(projectId, (p) => {
    let hit = false
    const messages = p.messages.map((m): Message => {
      if (m.role !== 'agent' || !m.parts.some((x) => x.id === partId)) return m
      return {
        ...m,
        parts: m.parts.map((x) => {
          if (x.id !== partId || x.type !== type) return x
          hit = true
          return fn(x as Extract<Part, { type: T }>)
        }),
      }
    })
    return hit ? { ...p, messages } : p
  })
}

export function editProgressItem(
  projectId: string,
  partId: string,
  itemId: string,
  patch: Partial<ProgressItem>
) {
  editPart(projectId, partId, 'progress', (part) => ({
    ...part,
    items: part.items.map((it) =>
      it.id === itemId ? { ...it, ...patch } : it
    ),
  }))
}

export function editNode(
  projectId: string,
  nodeId: string,
  fn: (n: CanvasNode) => CanvasNode
) {
  edit(projectId, (p) => {
    if (!p.nodes.some((n) => n.id === nodeId)) return p
    return { ...p, nodes: p.nodes.map((n) => (n.id === nodeId ? fn(n) : n)) }
  })
}

export function addGroup(
  projectId: string,
  group: CanvasGroup,
  nodes: CanvasNode[]
) {
  edit(projectId, (p) => ({
    ...p,
    groups: [...p.groups.filter((g) => g.id !== group.id), group],
    nodes: [...p.nodes, ...nodes],
  }))
}

/** Adds money to the message and the project. */
export function addCost(projectId: string, messageId: string, usd: number) {
  if (!(usd > 0)) return
  edit(projectId, (p) => ({
    ...p,
    cost: p.cost + usd,
    messages: p.messages.map((m) =>
      m.id === messageId && m.role === 'agent'
        ? { ...m, cost: m.cost + usd }
        : m
    ),
  }))
}

export function projectExists(projectId: string): boolean {
  return findProject(projectId) != null
}
