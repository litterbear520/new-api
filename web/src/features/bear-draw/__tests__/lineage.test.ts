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

import type { Ctx } from '../lib/canvas/context'
import { DEFAULT_LABELS } from '../lib/canvas/labels'
import { toolbarList } from '../lib/canvas/toolbar'
import { editedNode, editedPair } from '../lib/lineage'
import type { Attachment, CanvasNode, Project } from '../types'

const node = (id: string, over: Partial<CanvasNode> = {}): CanvasNode =>
  ({
    id,
    groupId: 'g1',
    status: 'ready',
    w: 1,
    h: 1,
    label: id,
    meta: {},
    ...over,
  }) as CanvasNode

/** A project whose set g1 drew these pictures. */
const project = (nodes: CanvasNode[], drew = ['n_new', 'n_new2']) =>
  ({
    nodes,
    messages: [
      {
        role: 'agent',
        parts: [
          {
            type: 'progress',
            groupId: 'g1',
            items: drew.map((nodeId) => ({ nodeId })),
          },
        ],
      },
    ],
  }) as unknown as Project

describe('which picture an edit came from', () => {
  const ref = (over: Partial<Attachment>): Attachment => ({
    id: 'x',
    w: 1,
    h: 1,
    ...over,
  })

  it('is the circled picture, else the only canvas picture attached', () => {
    expect(
      editedNode([ref({ nodeId: 'n_b' }), ref({ nodeId: 'n_a', marked: true })])
    ).toBe('n_a')
    expect(editedNode([ref({}), ref({ nodeId: 'n_b' })])).toBe('n_b')
    expect(
      editedNode([ref({ nodeId: 'n_a' }), ref({ nodeId: 'n_b' })])
    ).toBeUndefined()
    expect(editedNode([ref({})])).toBeUndefined()
  })

  it('gives the result card one pair, or none', () => {
    const src = node('n_src', { groupId: 'g0' })
    const edit = node('n_new', { meta: { parentId: 'n_src' } })
    expect(editedPair(project([src, edit]), 'g1')).toEqual({
      from: 'n_src',
      to: 'n_new',
    })
    // the original was removed, or the project is from before the record
    expect(editedPair(project([edit]), 'g1')).toBeNull()
    expect(editedPair(project([src, node('n_new')]), 'g1')).toBeNull()
    // several edits in one set: no single pair
    const second = node('n_new2', { meta: { parentId: 'n_src' } })
    expect(editedPair(project([src, edit, second]), 'g1')).toBeNull()
    // dragged into another set since: still the picture this set drew
    const moved = { ...edit, groupId: 'g9' }
    const other = node('n_other', { meta: { parentId: 'n_src' } })
    expect(editedPair(project([src, moved, other]), 'g1')).toEqual({
      from: 'n_src',
      to: 'n_new',
    })
  })
})

describe('对比原图 on the toolbar', () => {
  const ctx = (parent?: { status: string }) =>
    ({
      o: {},
      L: DEFAULT_LABELS,
      sel: new Set(['n_new']),
      groups: new Map(),
      nodes: new Map<string, unknown>([
        [
          'n_new',
          { id: 'n_new', status: 'ready', meta: { parentId: 'n_src' } },
        ],
        ...(parent ? [['n_src', parent] as [string, unknown]] : []),
      ]),
    }) as unknown as Ctx
  const has = (c: Ctx) =>
    toolbarList(c, 'image').some((a) => a.id === 'compare-source')

  it('shows only while the original is still on the canvas', () => {
    expect(has(ctx({ status: 'ready' }))).toBe(true)
    expect(has(ctx())).toBe(false)
    expect(has(ctx({ status: 'failed' }))).toBe(false)
  })
})
