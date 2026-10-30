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
import type { DrawImage, DrawRoom } from '../types'

/*
 * Conversations and pictures live only in this browser (IndexedDB), one
 * record per conversation and one per picture, tagged with the user id so
 * two accounts on the same browser never see each other's pictures.
 */

const DB_NAME = 'xiaoxiong-draw'
const ROOMS = 'rooms'
const IMAGES = 'images'

type StoredRoom = DrawRoom & { uid: number }
type StoredImage = { id: string; uid: number; blob: Blob; thumb?: Blob }

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
      const db = req.result
      db.createObjectStore(ROOMS, { keyPath: 'id' }).createIndex('uid', 'uid')
      db.createObjectStore(IMAGES, { keyPath: 'id' }).createIndex('uid', 'uid')
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

/**
 * Pictures still drawing when the page closed can never arrive. Pictures
 * still waiting for a slot were never sent, and a plan still being made is
 * marked so the user can start it again.
 */
export function settleLost(room: DrawRoom): DrawRoom {
  let changed = false
  const msgs = room.msgs.map((msg) => {
    if (msg.role !== 'ai') return msg
    const planning = msg.plan?.status === 'planning'
    if (!planning && !msg.items.some((it) => it.status === 'pending')) {
      return msg
    }
    changed = true
    return {
      ...msg,
      ...(planning && msg.plan
        ? { plan: { ...msg.plan, status: 'stale' as const } }
        : {}),
      items: msg.items.map((it) =>
        it.status === 'pending'
          ? {
              ...it,
              status: 'error' as const,
              queued: undefined,
              error: {
                kind: it.queued ? ('other' as const) : ('lost' as const),
              },
            }
          : it
      ),
    }
  })
  return changed ? { ...room, msgs } : room
}

export async function loadRooms(uid: number): Promise<DrawRoom[]> {
  const db = await openDb()
  const tx = db.transaction(ROOMS, 'readonly')
  const rows = (await done(
    tx.objectStore(ROOMS).index('uid').getAll(uid)
  )) as StoredRoom[]
  return rows
    .map(({ uid: _uid, ...room }) => settleLost(room))
    .sort((a, b) => b.t - a.t)
}

export async function saveRoom(uid: number, room: DrawRoom): Promise<void> {
  if (room.fresh) return
  const msgs = room.msgs.map((msg) =>
    msg.role === 'ai'
      ? {
          ...msg,
          items: msg.items.map(({ rv: _rv, cvAt: _cvAt, ...it }) => it),
        }
      : msg
  )
  const db = await openDb()
  const tx = db.transaction(ROOMS, 'readwrite')
  tx.objectStore(ROOMS).put({ ...room, msgs, uid } satisfies StoredRoom)
  await committed(tx)
}

/** Every stored picture a conversation refers to. */
export function imagesOf(room: DrawRoom): DrawImage[] {
  const out: DrawImage[] = []
  for (const msg of room.msgs) {
    if (msg.role === 'user') out.push(...msg.imgs)
    else for (const it of msg.items) if (it.img) out.push(it.img)
  }
  if (room.mark) out.push(room.mark.img)
  return out
}

export async function deleteRoom(room: DrawRoom, keep: Set<string>) {
  const db = await openDb()
  const tx = db.transaction([ROOMS, IMAGES], 'readwrite')
  tx.objectStore(ROOMS).delete(room.id)
  for (const img of imagesOf(room)) {
    if (!keep.has(img.id)) tx.objectStore(IMAGES).delete(img.id)
  }
  await committed(tx)
}

export async function putImage(
  uid: number,
  id: string,
  blob: Blob,
  thumb?: Blob
): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(IMAGES, 'readwrite')
  tx.objectStore(IMAGES).put({ id, uid, blob, thumb } satisfies StoredImage)
  await committed(tx)
}

/** Deletes stored pictures by id (the design agent's projects use this store too). */
export async function deleteImages(ids: Iterable<string>): Promise<void> {
  const list = [...ids]
  if (!list.length) return
  const db = await openDb()
  const tx = db.transaction(IMAGES, 'readwrite')
  for (const id of list) tx.objectStore(IMAGES).delete(id)
  await committed(tx)
}

export async function getImageBlob(
  id: string,
  variant: 'full' | 'thumb'
): Promise<Blob | null> {
  const db = await openDb()
  const tx = db.transaction(IMAGES, 'readonly')
  const row = (await done(tx.objectStore(IMAGES).get(id))) as
    | StoredImage
    | undefined
  if (!row) return null
  return variant === 'thumb' ? (row.thumb ?? row.blob) : row.blob
}

/** True when the browser's storage for this site is nearly full. */
export async function storageNearlyFull(): Promise<boolean> {
  try {
    const est = await navigator.storage?.estimate?.()
    if (!est?.quota || est.usage == null) return false
    return est.usage / est.quota > 0.9
  } catch {
    return false
  }
}

/** Ask the browser not to clear our pictures under storage pressure. */
export function requestPersistence() {
  try {
    void navigator.storage?.persist?.()
  } catch {
    // Not supported: the browser decides on its own.
  }
}

export function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
}
