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
import type { CanvasNode, Message, Part, Project } from '../types'

/*
 * Projects live only in this browser (IndexedDB `xiaoxiong-design`, one
 * record per project, tagged with the user id). Pictures stay in the
 * classic page's image store (features/draw/lib/storage.ts), so projects
 * copied from the classic page share them instead of duplicating blobs.
 */

const DB_NAME = 'xiaoxiong-design'
const PROJECTS = 'projects'

type StoredProject = Project & { uid: number }

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.addEventListener('upgradeneeded', () => {
      req.result
        .createObjectStore(PROJECTS, { keyPath: 'id' })
        .createIndex('uid', 'uid')
    })
    req.addEventListener('success', () => resolve(req.result))
    req.addEventListener('error', () =>
      reject(req.error ?? new Error('IndexedDB open failed'))
    )
  })
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.addEventListener('success', () => resolve(req.result))
    req.addEventListener('error', () =>
      reject(req.error ?? new Error('IndexedDB request failed'))
    )
  })
}

function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.addEventListener('complete', () => resolve())
    tx.addEventListener('error', () =>
      reject(tx.error ?? new Error('IndexedDB write failed'))
    )
    tx.addEventListener('abort', () =>
      reject(tx.error ?? new Error('IndexedDB write aborted'))
    )
  })
}

function settlePart(part: Part): Part {
  if (part.type === 'status' && part.live) return { ...part, live: false }
  if (part.type === 'text' && part.streaming) {
    return { ...part, streaming: false }
  }
  if (part.type === 'progress') {
    const busy = part.items.some(
      (it) => it.status === 'drawing' || it.status === 'queued'
    )
    if (!busy) return part
    return {
      ...part,
      items: part.items.map((it) => {
        // A picture still drawing when the page closed never arrives (and
        // was billed); one still waiting for a slot was never sent.
        if (it.status === 'drawing') return { ...it, status: 'lost' as const }
        if (it.status === 'queued') return { ...it, status: 'stopped' as const }
        return it
      }),
    }
  }
  return part
}

/**
 * Work that was running when the page closed can't come back: the agent's
 * reply stops where it was, drawing pictures are lost, queued ones were
 * never sent. Question cards and plans still wait for the user.
 */
export function settleProject(p: Project): Project {
  let changed = false
  const messages = p.messages.map((m): Message => {
    if (m.role !== 'agent') return m
    const parts = m.parts.map(settlePart)
    const partsChanged = parts.some((x, i) => x !== m.parts[i])
    if (m.status !== 'running') {
      // A stopped or finished message can still hold pictures that were
      // drawing (after ■, or a retry) when the page closed.
      if (!partsChanged) return m
      changed = true
      return { ...m, parts }
    }
    changed = true
    const drew = m.parts.some((x) => x.type === 'progress')
    if (m.mode === 'agent' && !drew) {
      // Cut off while thinking: offer 重试这一步.
      return {
        ...m,
        parts: [
          ...parts,
          {
            id: `lost-${m.id}`,
            type: 'error',
            kind: 'network',
            message: 'The page was closed before this step finished.',
          },
        ],
        status: 'error',
        endedAt: m.endedAt ?? Date.now(),
      }
    }
    return { ...m, parts, status: 'lost', endedAt: m.endedAt ?? Date.now() }
  })
  const stoppedNodes = new Set<string>()
  for (const m of messages) {
    if (m.role !== 'agent') continue
    for (const part of m.parts) {
      if (part.type !== 'progress') continue
      for (const it of part.items) {
        if (it.status === 'stopped') stoppedNodes.add(it.nodeId)
      }
    }
  }
  const nodes = p.nodes.map((n) => {
    if (n.status !== 'pending') return n
    changed = true
    const status = stoppedNodes.has(n.id) ? 'stopped' : 'failed'
    return { ...n, status } satisfies CanvasNode
  })
  return changed ? { ...p, messages, nodes } : p
}

export async function loadProjects(uid: number): Promise<Project[]> {
  const db = await openDb()
  const tx = db.transaction(PROJECTS, 'readonly')
  const rows = (await done(
    tx.objectStore(PROJECTS).index('uid').getAll(uid)
  )) as StoredProject[]
  return rows
    .map(({ uid: _uid, ...p }) => settleProject(p))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveProject(uid: number, p: Project): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(PROJECTS, 'readwrite')
  tx.objectStore(PROJECTS).put({ ...p, uid } satisfies StoredProject)
  await committed(tx)
}

export async function removeProjectRecord(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(PROJECTS, 'readwrite')
  tx.objectStore(PROJECTS).delete(id)
  await committed(tx)
}

/** Every stored picture a project refers to. */
export function imageIdsOf(p: Project): Set<string> {
  const ids = new Set<string>()
  for (const n of p.nodes) if (n.img) ids.add(n.img.id)
  for (const m of p.messages) {
    if (m.role === 'user') {
      for (const r of m.refs) ids.add(r.id)
      continue
    }
    for (const part of m.parts) {
      if (part.type !== 'progress') continue
      for (const it of part.items) if (it.img) ids.add(it.img.id)
    }
  }
  return ids
}
