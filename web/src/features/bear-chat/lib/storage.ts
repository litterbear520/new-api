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
import type { ChatSettings, Conversation, Reply } from '../types'

/*
 * Conversations live only in this browser (IndexedDB), one record per
 * conversation, tagged with the user id so two accounts on one browser never
 * see each other's chats. Settings (model, parameters, the bear's mood, the
 * panel width) are small and go to localStorage.
 */

const DB_NAME = 'xiaoxiong-chat'
const CONVS = 'convs'
const SETTINGS_KEY = 'bear-chat.settings'

type StoredConv = Conversation & { uid: number }

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
        .createObjectStore(CONVS, { keyPath: 'id' })
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

/** A reply still streaming when the page closed can never finish. */
function settleReply(reply: Reply): Reply {
  if (reply.status !== 'waiting' && reply.status !== 'streaming') return reply
  return { ...reply, status: 'stopped', endedAt: reply.endedAt ?? Date.now() }
}

export function settleConversation(conv: Conversation): Conversation {
  let changed = false
  const turns = conv.turns.map((turn) => {
    if (turn.role !== 'assistant') return turn
    const replies = turn.replies.map(settleReply)
    if (replies.every((r, i) => r === turn.replies[i])) return turn
    changed = true
    return { ...turn, replies }
  })
  return changed ? { ...conv, turns } : conv
}

export async function loadConversations(uid: number): Promise<Conversation[]> {
  const db = await openDb()
  const tx = db.transaction(CONVS, 'readonly')
  const rows = (await done(
    tx.objectStore(CONVS).index('uid').getAll(uid)
  )) as StoredConv[]
  return rows
    .map(({ uid: _uid, ...conv }) => settleConversation(conv))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveConversation(
  uid: number,
  conv: Conversation
): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(CONVS, 'readwrite')
  tx.objectStore(CONVS).put({ ...conv, uid } satisfies StoredConv)
  await committed(tx)
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(CONVS, 'readwrite')
  tx.objectStore(CONVS).delete(id)
  await committed(tx)
}

export function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
}

export function readSettings(): Partial<ChatSettings> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object'
      ? (parsed as Partial<ChatSettings>)
      : {}
  } catch {
    return {}
  }
}

export function writeSettings(settings: ChatSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // private mode: settings reset next visit
  }
}
