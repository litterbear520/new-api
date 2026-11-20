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
import type { TFunction } from 'i18next'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import {
  type ActionContext,
  runCanvasAction,
} from '../components/canvas/canvas-actions'
import type {
  ActionPayload,
  CanvasApi,
  PublicGroup,
  PublicNode,
} from '../lib/canvas/types'
import type { CanvasGroup, CanvasNode, Project } from '../types'

/* Delete on the canvas, then 撤销 from the toast puts it all back. */

vi.mock('sonner', () => ({ toast: vi.fn() }))

const node = (id: string, groupId: string | null): CanvasNode => ({
  id,
  groupId,
  status: 'ready',
  img: { id: `img-${id}`, w: 800, h: 800 },
  w: 800,
  h: 800,
  label: id,
  meta: {},
})

const set = (id: string, children: string[]): CanvasGroup => ({
  id,
  title: id,
  subtitle: `${children.length} · 淘宝`,
  x: 0,
  y: 0,
  children,
})

const project = (): Project =>
  ({
    id: 'p1',
    title: 'p1',
    createdAt: 1,
    updatedAt: 1,
    cost: 0,
    messages: [],
    transcript: [],
    groups: [set('g1', ['a', 'b', 'c']), set('g2', ['d'])],
    nodes: [
      node('a', 'g1'),
      node('b', 'g1'),
      node('c', 'g1'),
      node('d', 'g2'),
      node('free', null),
    ],
  }) as unknown as Project

const t = ((k: string) => k) as unknown as TFunction

function ctx(): ActionContext {
  return {
    project: findProject('p1') as Project,
    cb: {
      onEdit: vi.fn(),
      onMarked: vi.fn(),
      onUpload: vi.fn(),
      onExport: vi.fn(),
    },
    cv: {} as CanvasApi,
    t,
    pickFiles: vi.fn(),
  }
}

const pub = (id: string) => ({ id }) as PublicNode

function deletePictures(ids: string[]) {
  const kind = ids.length > 1 ? 'multi' : 'image'
  const p = { ids, kind, nodes: ids.map(pub) } as ActionPayload
  return runCanvasAction(ctx(), 'delete', p)
}

function deleteSet(id: string) {
  const g = findProject('p1')?.groups.find((x) => x.id === id)
  const p = {
    ids: [id],
    kind: 'group',
    group: { id } as PublicGroup,
    nodes: (g?.children ?? []).map(pub),
  } as ActionPayload
  return runCanvasAction(ctx(), 'delete', p)
}

/** The 撤销 button of the n-th toast. */
function undo(n = 0) {
  const opts = vi.mocked(toast).mock.calls[n]?.[1] as {
    action: { label: string; onClick: () => void }
  }
  opts.action.onClick()
}

const shape = (p: Project | null) => ({
  nodes: p?.nodes.map((n) => `${n.id}:${n.groupId}`),
  groups: p?.groups.map((g) => `${g.id}[${g.children}] ${g.subtitle}`),
})

describe('deleting on the canvas can be undone', () => {
  beforeEach(() => {
    useBearDrawStore.setState({ uid: null, loaded: false, projects: [] })
    useBearDrawStore.getState().init(1, [project()])
  })
  afterEach(() => vi.clearAllMocks())

  test('a picture: a toast with 撤销, no confirmation; 撤销 puts it back in its place', () => {
    const before = shape(findProject('p1'))
    expect(deletePictures(['b'])).toBe(false)
    expect(findProject('p1')?.nodes.some((n) => n.id === 'b')).toBe(false)
    expect(toast).toHaveBeenCalledTimes(1)
    const [message, opts] = vi.mocked(toast).mock.calls[0]
    expect(message).toBe('Picture deleted')
    expect(opts).toMatchObject({ action: { label: 'Undo' } })
    undo()
    expect(shape(findProject('p1'))).toEqual(before)
  })

  test('a whole set comes back with its frame, pictures and count', () => {
    const before = shape(findProject('p1'))
    deleteSet('g1')
    expect(findProject('p1')?.groups.map((g) => g.id)).toEqual(['g2'])
    expect(vi.mocked(toast).mock.calls[0][0]).toBe('Set deleted')
    undo()
    expect(shape(findProject('p1'))).toEqual(before)
  })

  test('undoing one delete leaves a later one alone', () => {
    deletePictures(['a', 'free'])
    expect(vi.mocked(toast).mock.calls[0][0]).toBe('Pictures deleted')
    deletePictures(['c'])
    undo(0)
    const p = findProject('p1')
    expect(p?.nodes.map((n) => n.id)).toEqual(['a', 'b', 'd', 'free'])
    expect(p?.groups[0].children).toEqual(['a', 'b'])
    expect(p?.groups[0].subtitle).toBe('2 · 淘宝')
    // A second press does nothing more.
    undo(0)
    expect(findProject('p1')?.nodes).toHaveLength(4)
  })

  test('a picture that finished drawing while deleted comes back drawn', () => {
    const drawing = { ...node('b', 'g1'), status: 'pending' as const }
    drawing.img = undefined
    useBearDrawStore.getState().updateProject('p1', (p) => ({
      ...p,
      nodes: p.nodes.map((n) => (n.id === 'b' ? drawing : n)),
    }))
    deletePictures(['b'])
    // The drawing ends while b is gone: only its chat item gets the picture.
    useBearDrawStore.getState().updateProject('p1', (p) => ({
      ...p,
      messages: [
        {
          id: 'm1',
          role: 'agent',
          parts: [
            {
              id: 'part1',
              type: 'progress',
              items: [
                {
                  id: 'it1',
                  nodeId: 'b',
                  label: 'b',
                  model: 'image-model',
                  prompt: '',
                  status: 'done',
                  img: { id: 'img-new', w: 600, h: 900 },
                  cost: 0.04,
                  secs: 12,
                },
              ],
            },
          ],
        },
      ] as unknown as Project['messages'],
    }))
    undo()
    const b = findProject('p1')?.nodes.find((n) => n.id === 'b')
    expect(b?.status).toBe('ready')
    expect(b?.img?.id).toBe('img-new')
    expect([b?.w, b?.h]).toEqual([600, 900])
  })
})
