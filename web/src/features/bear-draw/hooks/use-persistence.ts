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

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { classicRooms, markMigrated } from '../lib/migrate'
import { loadProjects, removeProjectRecord, saveProject } from '../lib/storage'
import type { Project } from '../types'

/*
 * Loads this user's projects (copying the classic page's conversations
 * once) and writes every changed project back a moment later, at least
 * every 2 s while the agent works. Saving lives at module level, so work
 * that finishes after the user left the page is still kept.
 */

const SAVE_DELAY = 500
const MAX_WAIT = 2000
const timers = new Map<
  string,
  { t: ReturnType<typeof setTimeout>; since: number }
>()
let unsubscribe: (() => void) | null = null

/** An empty project (opened, nothing sent) is not worth storing. */
const worthSaving = (p: Project) => p.messages.length > 0 || p.nodes.length > 0

function scheduleSave(uid: number, p: Project) {
  const old = timers.get(p.id)
  const since = old?.since ?? Date.now()
  if (old) clearTimeout(old.t)
  const wait = Math.max(
    0,
    Math.min(SAVE_DELAY, MAX_WAIT - (Date.now() - since))
  )
  timers.set(p.id, {
    since,
    t: setTimeout(() => {
      timers.delete(p.id)
      const latest = useBearDrawStore
        .getState()
        .projects.find((x) => x.id === p.id)
      if (latest && worthSaving(latest)) {
        void saveProject(uid, latest).catch(() => undefined)
      }
    }, wait),
  })
}

/** Writes everything pending right away (the tab is being hidden or closed). */
function flush() {
  const s = useBearDrawStore.getState()
  if (s.uid == null) return
  for (const [id, timer] of timers) {
    clearTimeout(timer.t)
    const p = s.projects.find((x) => x.id === id)
    if (p && worthSaving(p)) void saveProject(s.uid, p).catch(() => undefined)
  }
  timers.clear()
}

function watch() {
  if (unsubscribe) return
  unsubscribe = useBearDrawStore.subscribe((state, prev) => {
    // loading a user's projects (or another user's) is not an edit
    if (state.projects === prev.projects || state.uid == null) return
    if (!prev.loaded || state.uid !== prev.uid) return
    const before = new Map(prev.projects.map((p) => [p.id, p]))
    for (const p of state.projects) {
      if (before.get(p.id) !== p) scheduleSave(state.uid, p)
      before.delete(p.id)
    }
    // whatever is left was deleted
    for (const id of before.keys()) {
      const pending = timers.get(id)
      if (pending) clearTimeout(pending.t)
      timers.delete(id)
      void removeProjectRecord(id).catch(() => undefined)
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}

export type LoadState = 'loading' | 'ready' | 'unavailable'

export function useBearDrawPersistence(uid: number | undefined): LoadState {
  const loadedUid = useBearDrawStore((s) => (s.loaded ? s.uid : null))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!uid) return
    watch()
    const s = useBearDrawStore.getState()
    if (s.loaded && s.uid === uid) return
    let cancelled = false
    const load = async () => {
      const projects = await loadProjects(uid)
      const have = new Set(projects.map((p) => p.id))
      const copies = (await classicRooms(uid)).filter((p) => !have.has(p.id))
      if (cancelled) return
      const store = useBearDrawStore.getState()
      store.init(uid, [...projects, ...copies])
      // A card left waiting before the reload still waits for the user.
      for (const p of projects) {
        const waiting = p.messages.some(
          (m) => m.role === 'agent' && m.status === 'waiting'
        )
        if (waiting) store.setLive(p.id, { phase: 'wait', since: Date.now() })
      }
      if (copies.length) {
        await Promise.all(copies.map((p) => saveProject(uid, p)))
      }
      markMigrated(uid)
    }
    load().catch(() => {
      if (cancelled) return
      // no IndexedDB (some private windows): projects last for this visit
      setFailed(true)
      useBearDrawStore.getState().init(uid, [])
    })
    return () => {
      cancelled = true
    }
  }, [uid])

  if (failed) return 'unavailable'
  return loadedUid === uid ? 'ready' : 'loading'
}
