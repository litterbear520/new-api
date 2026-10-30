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
import { useEffect, useState } from 'react'

import { useBearChatStore } from '@/stores/bear-chat-store'

import { takeOldPlayground } from '../lib/migrate'
import {
  deleteConversation,
  loadConversations,
  saveConversation,
} from '../lib/storage'
import type { Conversation } from '../types'

/*
 * Loads this user's conversations and writes every changed one back a
 * moment later (at least every 2 s while a reply streams). Saving lives at
 * module level so a reply that finishes after the user left is still kept.
 */

const SAVE_DELAY = 400
const MAX_WAIT = 2000
const timers = new Map<
  string,
  { t: ReturnType<typeof setTimeout>; since: number }
>()
let unsubscribe: (() => void) | null = null

function scheduleSave(uid: number, conv: Conversation) {
  const old = timers.get(conv.id)
  const since = old?.since ?? Date.now()
  if (old) clearTimeout(old.t)
  const wait = Math.max(
    0,
    Math.min(SAVE_DELAY, MAX_WAIT - (Date.now() - since))
  )
  timers.set(conv.id, {
    since,
    t: setTimeout(() => {
      timers.delete(conv.id)
      const latest = useBearChatStore
        .getState()
        .convs.find((c) => c.id === conv.id)
      if (latest) void saveConversation(uid, latest).catch(() => undefined)
    }, wait),
  })
}

function watch() {
  unsubscribe ??= useBearChatStore.subscribe((state, prev) => {
    // loading a user's chats (or another user's) is not an edit
    if (state.convs === prev.convs || state.uid == null) return
    if (!prev.loaded || state.uid !== prev.uid) return
    const before = new Map(prev.convs.map((c) => [c.id, c]))
    for (const conv of state.convs) {
      if (before.get(conv.id) !== conv) scheduleSave(state.uid, conv)
      before.delete(conv.id)
    }
    // whatever is left was deleted
    for (const id of before.keys()) {
      const pending = timers.get(id)
      if (pending) clearTimeout(pending.t)
      timers.delete(id)
      void deleteConversation(id).catch(() => undefined)
    }
  })
}

export type ChatLoadState = 'loading' | 'ready' | 'unavailable'

export function useChatPersistence(uid: number | undefined): ChatLoadState {
  const loadedUid = useBearChatStore((s) => (s.loaded ? s.uid : null))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!uid) return
    watch()
    const s = useBearChatStore.getState()
    if (s.loaded && s.uid === uid) return
    let cancelled = false
    loadConversations(uid)
      .then((convs) => {
        if (cancelled) return
        const old = takeOldPlayground()
        useBearChatStore.getState().init(uid, old ? [old, ...convs] : convs)
        if (old) void saveConversation(uid, old).catch(() => undefined)
      })
      .catch(() => {
        if (cancelled) return
        // no IndexedDB (some private windows): chats last for this visit
        setFailed(true)
        useBearChatStore.getState().init(uid, [])
      })
    return () => {
      cancelled = true
    }
  }, [uid])

  if (failed) return 'unavailable'
  return loadedUid === uid ? 'ready' : 'loading'
}
