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
import { create } from 'zustand'

import { DEFAULT_MODEL } from '@/features/draw/constants'
import type {
  DrawAttachment,
  DrawItem,
  DrawRatio,
  DrawRoom,
} from '@/features/draw/types'

/*
 * State of the drawing page. Conversations are written to IndexedDB by the
 * page (see features/draw/hooks/use-draw-persistence.ts); drawing itself
 * runs in features/draw/lib/generate.ts and keeps going if the user leaves
 * the page, so this store is global.
 */

export type DrawDraft = {
  text: string
  ratio: DrawRatio
  clear: boolean
  refs: DrawAttachment[]
}

export type DrawMode = 'mark' | 'compare' | null

type DrawState = {
  uid: number | null
  loaded: boolean
  rooms: DrawRoom[]
  /** The unsent new conversation, shown on the start page. */
  fresh: DrawRoom
  curId: string
  draft: DrawDraft
  mode: DrawMode
  /** Picture compared with the selected one. */
  cmp: string | null
  /** Ideas category open on the start page. */
  idea: string | null
}

type DrawActions = {
  init: (uid: number, rooms: DrawRoom[]) => void
  reset: () => void
  setCur: (id: string) => void
  goNew: (model?: string) => void
  /** Replaces a conversation; adds it when it was the fresh one. */
  putRoom: (room: DrawRoom) => void
  updateRoom: (id: string, fn: (room: DrawRoom) => DrawRoom) => void
  updateItem: (roomId: string, itemId: string, patch: Partial<DrawItem>) => void
  removeRoom: (id: string) => void
  setDraft: (patch: Partial<DrawDraft>) => void
  setMode: (mode: DrawMode, cmp?: string | null) => void
  setCmp: (id: string | null) => void
  setIdea: (id: string | null) => void
}

let seq = 0
export const newId = (prefix = 'd') =>
  `${prefix}${Date.now().toString(36)}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function createFreshRoom(model = DEFAULT_MODEL): DrawRoom {
  return {
    id: newId('r'),
    title: '',
    model,
    t: Date.now(),
    msgs: [],
    fresh: true,
  }
}

const emptyDraft = (): DrawDraft => ({
  text: '',
  ratio: 'auto',
  clear: false,
  refs: [],
})

function initialState(): DrawState {
  const fresh = createFreshRoom()
  return {
    uid: null,
    loaded: false,
    rooms: [],
    fresh,
    curId: fresh.id,
    draft: emptyDraft(),
    mode: null,
    cmp: null,
    idea: null,
  }
}

export const useDrawStore = create<DrawState & DrawActions>()((set) => ({
  ...initialState(),

  init: (uid, rooms) =>
    set((s) =>
      s.uid === uid && s.loaded
        ? s
        : { ...initialState(), uid, rooms, loaded: true }
    ),

  reset: () => set(initialState()),

  setCur: (id) =>
    set((s) =>
      s.curId === id
        ? s
        : {
            curId: id,
            mode: null,
            cmp: null,
            idea: null,
            draft: { ...s.draft, refs: [] },
          }
    ),

  goNew: (model) =>
    set((s) => {
      const cur = s.rooms.find((r) => r.id === s.curId)
      const fresh = createFreshRoom(model ?? cur?.model ?? s.fresh.model)
      return {
        fresh,
        curId: fresh.id,
        mode: null,
        cmp: null,
        idea: null,
        draft: { ...emptyDraft(), ratio: s.draft.ratio },
      }
    }),

  putRoom: (room) =>
    set((s) => {
      const stored = { ...room, fresh: undefined }
      const exists = s.rooms.some((r) => r.id === room.id)
      return {
        rooms: exists
          ? s.rooms.map((r) => (r.id === room.id ? stored : r))
          : [stored, ...s.rooms],
        fresh: s.fresh.id === room.id ? createFreshRoom(room.model) : s.fresh,
      }
    }),

  updateRoom: (id, fn) =>
    set((s) => {
      if (s.fresh.id === id) return { fresh: fn(s.fresh) }
      return { rooms: s.rooms.map((r) => (r.id === id ? fn(r) : r)) }
    }),

  updateItem: (roomId, itemId, patch) =>
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id !== roomId
          ? r
          : {
              ...r,
              msgs: r.msgs.map((m) =>
                m.role !== 'ai' || !m.items.some((it) => it.id === itemId)
                  ? m
                  : {
                      ...m,
                      items: m.items.map((it) =>
                        it.id === itemId ? { ...it, ...patch } : it
                      ),
                    }
              ),
            }
      ),
    })),

  removeRoom: (id) =>
    set((s) => {
      const rooms = s.rooms.filter((r) => r.id !== id)
      if (s.curId !== id) return { rooms }
      const fresh = createFreshRoom(s.fresh.model)
      return { rooms, fresh, curId: fresh.id, mode: null, cmp: null }
    }),

  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  setMode: (mode, cmp = null) => set({ mode, cmp }),
  setCmp: (cmp) => set({ cmp }),
  setIdea: (idea) => set({ idea }),
}))

// ---------------------------------------------------------------------------
// Selectors and helpers over conversations
// ---------------------------------------------------------------------------

export function currentRoom(s: DrawState): DrawRoom {
  return s.rooms.find((r) => r.id === s.curId) ?? s.fresh
}

export function roomItems(room: DrawRoom): DrawItem[] {
  return room.msgs.flatMap((m) => (m.role === 'ai' ? m.items : []))
}

export function findItem(room: DrawRoom, id: string | null | undefined) {
  if (!id) return null
  return roomItems(room).find((it) => it.id === id) ?? null
}

/** The picture on the canvas: the chosen one, else the newest. */
export function selectedItem(room: DrawRoom): DrawItem | null {
  return findItem(room, room.sel) ?? roomItems(room).at(-1) ?? null
}

/** The picture the composer edits, unless the user chose to draw a new one. */
export function baseItem(room: DrawRoom): DrawItem | null {
  const it = selectedItem(room)
  return !room.detached && it?.img ? it : null
}

export function pendingItems(rooms: DrawRoom[]): DrawItem[] {
  return rooms.flatMap((r) =>
    roomItems(r).filter((it) => it.status === 'pending')
  )
}

/** Estimated cost of every picture still drawing, held back from the balance. */
export function heldCostOf(rooms: DrawRoom[]): number {
  return pendingItems(rooms).reduce((sum, it) => sum + it.est, 0)
}

export function coverOf(room: DrawRoom) {
  return [...roomItems(room)].reverse().find((it) => it.img)?.img ?? null
}
