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
import { t } from 'i18next'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useDrawStore } from '@/stores/draw-store'

import { loadRooms, saveRoom } from '../lib/storage'
import type { DrawRoom } from '../types'

/*
 * Loads this user's conversations from IndexedDB and writes every changed
 * conversation back, a moment after it changes. Saving lives at module level
 * so a picture that finishes after the user left the page is still kept.
 * A failed save (usually a full browser storage) is told once and retried
 * after the next save that works.
 */

const SAVE_DELAY = 400
const timers = new Map<string, ReturnType<typeof setTimeout>>()
let unsubscribe: (() => void) | null = null
/** Conversations whose last save failed, by id. */
const unsaved = new Set<string>()
let warned = false

function saveFailed(id: string) {
  unsaved.add(id)
  if (warned) return
  warned = true
  toast.warning(
    t(
      'This browser could not save your latest changes, so they last only until you close the page. Delete old conversations to free space.'
    )
  )
}

/** `id` saved: retry the conversations whose save failed. */
function savedOk(uid: number, id: string) {
  unsaved.delete(id)
  const s = useDrawStore.getState()
  for (const failed of unsaved) {
    const room = s.uid === uid && s.rooms.find((r) => r.id === failed)
    // Gone, or another account's: nothing left to save.
    if (!room) unsaved.delete(failed)
    else if (!timers.has(failed)) scheduleSave(uid, room)
  }
  if (!unsaved.size) warned = false
}

function scheduleSave(uid: number, room: DrawRoom) {
  const old = timers.get(room.id)
  if (old) clearTimeout(old)
  timers.set(
    room.id,
    setTimeout(() => {
      timers.delete(room.id)
      const latest = useDrawStore.getState().rooms.find((r) => r.id === room.id)
      if (!latest) return
      void saveRoom(uid, latest)
        .then(() => savedOk(uid, room.id))
        .catch(() => saveFailed(room.id))
    }, SAVE_DELAY)
  )
}

function watchRooms() {
  unsubscribe ??= useDrawStore.subscribe((state, prev) => {
    if (state.rooms === prev.rooms || state.uid == null) return
    const before = new Map(prev.rooms.map((r) => [r.id, r]))
    for (const room of state.rooms) {
      if (before.get(room.id) !== room) scheduleSave(state.uid, room)
    }
  })
}

export type DrawLoadState = 'loading' | 'ready' | 'unavailable'

export function useDrawPersistence(uid: number | undefined): DrawLoadState {
  const loadedUid = useDrawStore((s) => (s.loaded ? s.uid : null))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!uid) return
    watchRooms()
    if (useDrawStore.getState().loaded && useDrawStore.getState().uid === uid) {
      return
    }
    let cancelled = false
    loadRooms(uid)
      .then((rooms) => {
        if (!cancelled) useDrawStore.getState().init(uid, rooms)
      })
      .catch(() => {
        if (cancelled) return
        // No IndexedDB (e.g. some private windows): pictures last for this visit.
        setFailed(true)
        useDrawStore.getState().init(uid, [])
      })
    return () => {
      cancelled = true
    }
  }, [uid])

  if (failed) return 'unavailable'
  return loadedUid === uid ? 'ready' : 'loading'
}
