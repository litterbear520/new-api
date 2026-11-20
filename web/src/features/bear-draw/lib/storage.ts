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
import { announce } from './tab-sync'

/*
 * Projects live only in this browser (IndexedDB `xiaoxiong-design`, one
 * record per project, tagged with the user id). Pictures stay in the
 * classic page's image store (features/draw/lib/storage.ts), so projects
 * copied from the classic page share them instead of duplicating blobs.
 * Each record carries a version (`rev`), raised by every save, so a tab
 * never overwrites what another tab stored after it last read the project.
 */

const DB_NAME = 'xiaoxiong-design'
const PROJECTS = 'projects'

/** `rev` is missing on records stored before versions were kept (0). */
type StoredProject = Project & { uid: number; rev?: number }

/** A project as stored (not settled), with its version. */
export type ProjectRecord = { project: Project; rev: number; uid: number }

export type SaveResult =
  | { ok: true; rev: number }
  /** Stored by another tab since: its copy (null when deleted) and version. */
  | { ok: false; stored: Project | null; rev: number | null }

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

function toRecord(row: StoredProject): ProjectRecord {
  const { uid, rev, ...project } = row
  return { project, rev: rev ?? 0, uid }
}

/** This user's projects as stored, newest first. */
export async function loadProjectRecords(
  uid: number
): Promise<ProjectRecord[]> {
  const db = await openDb()
  const tx = db.transaction(PROJECTS, 'readonly')
  const rows = (await done(
    tx.objectStore(PROJECTS).index('uid').getAll(uid)
  )) as StoredProject[]
  return rows
    .map(toRecord)
    .sort((a, b) => b.project.updatedAt - a.project.updatedAt)
}

export async function loadProjects(uid: number): Promise<Project[]> {
  return (await loadProjectRecords(uid)).map((r) => settleProject(r.project))
}

/** One stored project, or null when there is none. */
export async function loadProjectRecord(
  id: string
): Promise<ProjectRecord | null> {
  const db = await openDb()
  const tx = db.transaction(PROJECTS, 'readonly')
  const row = (await done(tx.objectStore(PROJECTS).get(id))) as
    | StoredProject
    | undefined
  return row ? toRecord(row) : null
}

/** Every stored project of every account on this browser, as stored. */
export async function allProjectRecords(): Promise<unknown[]> {
  const db = await openDb()
  const tx = db.transaction(PROJECTS, 'readonly')
  return (await done(tx.objectStore(PROJECTS).getAll())) as unknown[]
}

/**
 * The version a save based on `expected` gets, or null when the stored
 * record is not the one that save was based on (`expected` null: a project
 * never stored before).
 */
export function nextRev(
  stored: { rev?: number } | undefined,
  expected: number | null
): number | null {
  if (!stored) return expected === null ? 1 : null
  const rev = stored.rev ?? 0
  return expected === rev ? rev + 1 : null
}

/**
 * Stores `p` if the stored record is still version `expected`; otherwise
 * changes nothing and hands back the stored copy. Reading and writing
 * happen in one transaction, so two tabs can't both pass the check.
 */
export async function saveProject(
  uid: number,
  p: Project,
  expected: number | null
): Promise<SaveResult> {
  const db = await openDb()
  const tx = db.transaction(PROJECTS, 'readwrite')
  const store = tx.objectStore(PROJECTS)
  let result = null as SaveResult | null
  const read = store.get(p.id)
  read.addEventListener('success', () => {
    const row = read.result as StoredProject | undefined
    const rev = nextRev(row, expected)
    if (rev != null) {
      store.put({ ...p, uid, rev } satisfies StoredProject)
      result = { ok: true, rev }
      return
    }
    result = row
      ? { ok: false, stored: toRecord(row).project, rev: row.rev ?? 0 }
      : { ok: false, stored: null, rev: null }
  })
  await committed(tx)
  if (!result) throw new Error('IndexedDB read failed')
  return result
}

/** Rejects only when a stored record could not be deleted. */
export async function removeProjectRecord(id: string): Promise<void> {
  // No IndexedDB here (some private windows): nothing was ever stored.
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  const tx = db.transaction(PROJECTS, 'readwrite')
  tx.objectStore(PROJECTS).delete(id)
  await committed(tx)
  announce({ id, rev: null })
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
      for (const it of part.items) {
        if (it.img) ids.add(it.img.id)
        // Drawing a failed picture again sends these.
        for (const id of it.job?.inputs ?? []) ids.add(id)
      }
    }
  }
  // The planner's own conversation is sent again on the next turn.
  for (const m of p.transcript ?? []) {
    if (m.role === 'user') for (const id of m.images ?? []) ids.add(id)
  }
  return ids
}

/**
 * Every picture this user's stored projects refer to. The classic drawing
 * page keeps these when it deletes a conversation: copied projects point at
 * its pictures.
 */
export async function storedImageIds(uid: number): Promise<Set<string>> {
  const ids = new Set<string>()
  for (const p of await loadProjects(uid)) {
    for (const id of imageIdsOf(p)) ids.add(id)
  }
  return ids
}
