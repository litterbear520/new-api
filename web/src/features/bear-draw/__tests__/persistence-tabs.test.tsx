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
import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import { useBearDrawPersistence } from '../hooks/use-persistence'
import { loadProjectRecord } from '../lib/storage'
import type { Message, Project } from '../types'

/*
 * This tab is "B"; what another tab "A" does is written straight into the
 * fake store below (IndexedDB is not in jsdom) and, where a browser would,
 * announced on the fake BroadcastChannel.
 */

type Row = { project: Project; rev: number; uid: number }
const db = vi.hoisted(() => new Map<string, Row>())
const copy = <T,>(x: T): T => structuredClone(x)

vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))
vi.mock('@/features/draw/lib/storage', async (original) => ({
  ...(await original<typeof import('@/features/draw/lib/storage')>()),
  loadRooms: vi.fn(async () => []),
}))
vi.mock('../lib/orphan-images', () => ({ scheduleImageSweep: () => () => {} }))
vi.mock('../lib/storage', async (original) => {
  const real = await original<typeof import('../lib/storage')>()
  const rows = (uid: number) =>
    [...db.values()].filter((r) => r.uid === uid).map(copy)
  return {
    ...real,
    loadProjectRecords: vi.fn(async (uid: number) => rows(uid)),
    loadProjects: vi.fn(async (uid: number) =>
      rows(uid).map((r) => real.settleProject(r.project))
    ),
    loadProjectRecord: vi.fn(async (id: string) => {
      const row = db.get(id)
      return row ? copy(row) : null
    }),
    saveProject: vi.fn(
      async (uid: number, p: Project, expected?: number | null) => {
        const row = db.get(p.id)
        // Without a version (the page before this check): a plain overwrite.
        if (expected === undefined) {
          db.set(p.id, { project: copy(p), rev: (row?.rev ?? 0) + 1, uid })
          return undefined
        }
        const rev = real.nextRev(row, expected)
        if (rev == null) {
          return row
            ? { ok: false, stored: copy(row.project), rev: row.rev }
            : { ok: false, stored: null, rev: null }
        }
        db.set(p.id, { project: copy(p), rev, uid })
        return { ok: true, rev }
      }
    ),
  }
})

class FakeChannel {
  static all: FakeChannel[] = []
  posted: unknown[] = []
  private fns: ((e: MessageEvent) => void)[] = []
  constructor(public name: string) {
    FakeChannel.all.push(this)
  }
  addEventListener(_type: string, fn: (e: MessageEvent) => void) {
    this.fns.push(fn)
  }
  postMessage(data: unknown) {
    this.posted.push(data)
  }
  close() {}
  /** A message from another tab. */
  deliver(data: unknown) {
    for (const fn of this.fns) fn({ data } as MessageEvent)
  }
}
vi.stubGlobal('BroadcastChannel', FakeChannel)
const channel = () => FakeChannel.all[0]

const user = (id: string): Message => ({
  id,
  role: 'user',
  at: 1,
  mode: 'agent',
  text: id,
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

const project = (title: string, messages: Message[]): Project => ({
  id: 'p1',
  title,
  createdAt: 1,
  updatedAt: 1,
  cost: 0,
  messages,
  transcript: [],
  groups: [],
  nodes: [],
})

const twoMessages = () => [user('u1'), reply('a1')]
const fourMessages = () => [...twoMessages(), user('u2'), reply('a2')]

/** Tab A stores a new version of p1. */
function otherTabStores(p: Project) {
  const row = db.get('p1')
  const rev = (row?.rev ?? 0) + 1
  db.set('p1', { project: copy(p), rev, uid: 1 })
  return rev
}

const rename = (title: string) =>
  act(() =>
    useBearDrawStore
      .getState()
      .updateProject('p1', (p) => ({ ...p, title, updatedAt: 5 }))
  )

async function openPage() {
  const hook = renderHook(() => useBearDrawPersistence(1))
  await waitFor(() => expect(hook.result.current).toBe('ready'))
  return hook
}

beforeEach(() => {
  db.clear()
  localStorage.clear()
  vi.clearAllMocks()
  for (const c of FakeChannel.all) c.posted = []
  useBearDrawStore.setState({
    uid: null,
    loaded: false,
    projects: [],
    live: {},
  })
  db.set('p1', { project: project('start', twoMessages()), rev: 1, uid: 1 })
})

describe('two tabs on one project', () => {
  test('a rename in a tab with old data keeps the reply another tab stored', async () => {
    await openPage()
    otherTabStores(project('start', fourMessages()))

    rename('B name')

    await waitFor(() => expect(db.get('p1')?.project.title).toBe('B name'))
    expect(db.get('p1')?.project.messages).toHaveLength(4)
    expect(findProject('p1')?.messages).toHaveLength(4)
    expect(toast.warning).not.toHaveBeenCalled()
  })

  test('a rename both tabs made differently keeps the stored one and says so', async () => {
    await openPage()
    otherTabStores(project('A name', twoMessages()))

    rename('B name')

    await waitFor(() => expect(toast.warning).toHaveBeenCalledTimes(1))
    expect(db.get('p1')?.project.title).toBe('A name')
    expect(findProject('p1')?.title).toBe('A name')
  })

  test('a save is announced to the other tabs with its version', async () => {
    await openPage()

    rename('B name')

    await waitFor(() =>
      expect(channel().posted).toContainEqual(
        expect.objectContaining({ id: 'p1', rev: 2, uid: 1, busy: false })
      )
    )
  })
})

describe('news from another tab', () => {
  test('an idle tab reads the announced project again', async () => {
    await openPage()
    const rev = otherTabStores(project('start', fourMessages()))

    channel().deliver({ id: 'p1', rev, uid: 1, busy: false })

    await waitFor(() => expect(findProject('p1')?.messages).toHaveLength(4))
  })

  test('a tab still writing a reply is not interrupted', async () => {
    await openPage()
    const rev = otherTabStores(project('start', fourMessages()))
    act(() =>
      useBearDrawStore.getState().setLive('p1', { phase: 'write', since: 1 })
    )

    channel().deliver({ id: 'p1', rev, uid: 1, busy: false })

    expect(loadProjectRecord).not.toHaveBeenCalled()
    expect(findProject('p1')?.messages).toHaveLength(2)
  })

  test('a project deleted in another tab leaves this tab’s list', async () => {
    await openPage()
    db.delete('p1')

    act(() => channel().deliver({ id: 'p1', rev: null }))

    expect(findProject('p1')).toBeNull()
  })
})
