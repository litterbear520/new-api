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

import { mergeProjects, ownChanges } from '../lib/project-merge'
import type { CanvasNode, Message, Project } from '../types'

const user = (id: string, text: string): Message => ({
  id,
  role: 'user',
  at: 1,
  mode: 'agent',
  text,
  refs: [],
})

const reply = (id: string): Message => ({
  id,
  role: 'agent',
  mode: 'agent',
  parts: [{ id: `${id}-t`, type: 'text', text: 'done' }],
  status: 'done',
  startedAt: 1,
  cost: 0,
})

const node = (id: string, patch: Partial<CanvasNode> = {}): CanvasNode => ({
  id,
  groupId: null,
  status: 'ready',
  w: 100,
  h: 100,
  label: id,
  meta: {},
  ...patch,
})

const base: Project = {
  id: 'p1',
  title: 'start',
  createdAt: 1,
  updatedAt: 1,
  cost: 1,
  messages: [user('u1', 'hi'), reply('a1')],
  transcript: [],
  groups: [],
  nodes: [node('n1'), node('n2')],
}

describe('merging two tabs’ changes to one project', () => {
  test('a rename here and a reply stored by another tab both stay', () => {
    const mine = { ...base, title: 'renamed', updatedAt: 3 }
    const theirs = {
      ...base,
      updatedAt: 2,
      messages: [...base.messages, user('u2', 'more'), reply('a2')],
    }
    const merged = mergeProjects(base, mine, theirs)
    expect(merged?.title).toBe('renamed')
    expect(merged?.messages.map((m) => m.id)).toEqual(['u1', 'a1', 'u2', 'a2'])
    expect(merged?.updatedAt).toBe(3)
  })

  test('the same picture moved here and finished there keeps both edits', () => {
    const mine = {
      ...base,
      nodes: [node('n1', { x: 40, y: 50 }), base.nodes[1]],
    }
    const theirs = {
      ...base,
      nodes: [base.nodes[0], node('n2', { status: 'failed' })],
    }
    const merged = mergeProjects(base, mine, theirs)
    expect(merged?.nodes).toEqual([
      node('n1', { x: 40, y: 50 }),
      node('n2', { status: 'failed' }),
    ])
  })

  test('renamed differently in both tabs cannot be merged', () => {
    const mine = { ...base, title: 'mine' }
    const theirs = { ...base, title: 'theirs' }
    expect(mergeProjects(base, mine, theirs)).toBeNull()
  })

  test('messages added in both tabs cannot be merged', () => {
    const mine = { ...base, messages: [...base.messages, user('u2', 'here')] }
    const theirs = {
      ...base,
      messages: [...base.messages, user('u3', 'there')],
    }
    expect(mergeProjects(base, mine, theirs)).toBeNull()
  })

  test('a picture deleted here that the other tab changed cannot be merged', () => {
    const mine = { ...base, nodes: [base.nodes[1]] }
    const theirs = {
      ...base,
      nodes: [node('n1', { label: 'new' }), base.nodes[1]],
    }
    expect(mergeProjects(base, mine, theirs)).toBeNull()
  })

  test('money spent in both tabs adds up', () => {
    const mine = {
      ...base,
      cost: 1.5,
      nodes: [node('n1', { x: 1 }), base.nodes[1]],
    }
    const theirs = { ...base, cost: 1.25, title: 'other' }
    expect(mergeProjects(base, mine, theirs)?.cost).toBe(1.75)
  })
})

describe('the record a tab writes', () => {
  test('fields the tab did not touch keep the stored value, not the copy settled for display', () => {
    const raw = {
      ...base,
      messages: [
        user('u1', 'hi'),
        { ...reply('a1'), status: 'running' as const },
      ],
    }
    const view = { ...raw, messages: [raw.messages[0], reply('a1')] }
    const cur = { ...view, title: 'renamed' }
    const record = ownChanges(raw, view, cur)
    expect(record.title).toBe('renamed')
    expect(record.messages).toBe(raw.messages)
  })
})
