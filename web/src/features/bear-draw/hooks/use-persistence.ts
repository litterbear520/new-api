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

import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import { classicRooms, markMigrated } from '../lib/migrate'
import { scheduleImageSweep } from '../lib/orphan-images'
import {
  mergeProjects,
  ownChanges,
  rebase,
  sameValue,
  shownAfterMerge,
} from '../lib/project-merge'
import {
  loadProjectRecord,
  loadProjectRecords,
  saveProject,
  settleProject,
} from '../lib/storage'
import { announce, listenToOtherTabs, type ProjectNews } from '../lib/tab-sync'
import type { Project } from '../types'

/*
 * Loads this user's projects (copying the classic page's conversations
 * once) and writes every changed project back a moment later, at least
 * every 2 s while the agent works. Saving lives at module level, so work
 * that finishes after the user left the page is still kept. A failed save
 * (usually a full browser storage) is told once and retried after the next
 * save that works.
 *
 * Several tabs can have the page open. A save only lands on the stored
 * version this tab read; when another tab stored a newer one, both sides'
 * changes are merged, or, when they changed the same thing, this tab drops
 * its change and shows the stored project. After every save the other tabs
 * are told, and an idle tab reads the project again.
 */

const SAVE_DELAY = 500
const MAX_WAIT = 2000
const timers = new Map<
  string,
  { t: ReturnType<typeof setTimeout>; since: number }
>()
let unsubscribe: (() => void) | null = null
/** Projects whose last save failed, by id. */
const unsaved = new Set<string>()
let warned = false

/**
 * What this tab last read or stored of each project: the version, the
 * record as stored, and the object it put in the store for it.
 */
type Base = { rev: number; raw: Project; view: Project }
const bases = new Map<string, Base>()
/** Saves in progress per project; each waits for the one before. */
const writes = new Map<string, Promise<void>>()

function saveFailed(id: string) {
  unsaved.add(id)
  if (warned) return
  warned = true
  toast.warning(
    t(
      'This browser could not save your latest changes, so they last only until you close the page. Delete old projects to free space.'
    )
  )
}

/** `id` saved: retry the projects whose save failed. */
function savedOk(uid: number, id: string) {
  unsaved.delete(id)
  const s = useBearDrawStore.getState()
  for (const failed of unsaved) {
    const p = s.uid === uid && s.projects.find((x) => x.id === failed)
    // Gone, or another account's: nothing left to save.
    if (!p) unsaved.delete(failed)
    else if (!timers.has(failed)) scheduleSave(uid, p)
  }
  if (!unsaved.size) warned = false
}

/** The agent or pictures of this tab are working on it (not waiting for you). */
function busyHere(id: string): boolean {
  const live = useBearDrawStore.getState().live[id]
  return Boolean(live && live.phase !== 'wait')
}

/** A question card left waiting shows the bear waiting, in any tab. */
function syncWaiting(p: Project) {
  const s = useBearDrawStore.getState()
  const waiting = p.messages.some(
    (m) => m.role === 'agent' && m.status === 'waiting'
  )
  const live = s.live[p.id]
  if (waiting && !live) s.setLive(p.id, { phase: 'wait', since: Date.now() })
  if (!waiting && live?.phase === 'wait') s.setLive(p.id, null)
}

/** Shows the stored copy of a project in this tab, without saving it again. */
function show(id: string, rev: number, raw: Project): Project {
  const view = settleProject(raw)
  bases.set(id, { rev, raw, view })
  const s = useBearDrawStore.getState()
  if (findProject(id)) s.updateProject(id, () => view)
  else s.putProject(view)
  syncWaiting(view)
  return view
}

/** Another tab deleted it; a tab still working on it finishes first. */
function deletedElsewhere(id: string, tell: boolean) {
  if (!findProject(id) || busyHere(id)) return
  bases.delete(id)
  useBearDrawStore.getState().removeProject(id)
  if (tell) toast.warning(t('This project was deleted in another tab.'))
}

/** A merged record was stored: show the other tab's changes here too. */
function adoptMerged(
  id: string,
  cur: Project,
  base: Base | undefined,
  record: Project,
  rev: number
) {
  const view = base ? shownAfterMerge(base.raw, base.view, record) : record
  bases.set(id, { rev, raw: record, view })
  const latest = findProject(id)
  if (!latest) return
  // Edits made while saving stay; the next save stores them.
  const next = latest === cur ? view : rebase(cur, latest, view)
  useBearDrawStore.getState().updateProject(id, () => next)
}

/** `mine` and the stored copy as one project, or null when they can't be merged. */
function mergeWithStored(
  base: Base | undefined,
  mine: Project,
  stored: Project
): Project | null {
  if (base) return mergeProjects(base.raw, mine, stored)
  // Never read here (e.g. two tabs copying the same classic conversation).
  return sameValue(mine, stored) ? mine : null
}

async function write(uid: number, id: string): Promise<void> {
  const cur = findProject(id)
  if (!cur || !worthSaving(cur)) return
  const base = bases.get(id)
  if (base?.view === cur) return
  const mine = base ? ownChanges(base.raw, base.view, cur) : cur
  let record = mine
  let expected = base ? base.rev : null
  // Another tab may save in between again; after a few rounds it wins.
  for (let round = 0; round < 3; round++) {
    const res = await saveProject(uid, record, expected)
    if (res.ok) {
      if (record === mine) {
        bases.set(id, { rev: res.rev, raw: record, view: cur })
      } else adoptMerged(id, cur, base, record, res.rev)
      announce({ id, rev: res.rev, uid, busy: busyHere(id) })
      return
    }
    if (!res.stored || res.rev == null) {
      deletedElsewhere(id, true)
      return
    }
    const merged = mergeWithStored(base, mine, res.stored)
    if (!merged) break
    if (sameValue(merged, res.stored)) {
      // Already stored like this: nothing to write.
      adoptMerged(id, cur, base, merged, res.rev)
      return
    }
    record = merged
    expected = res.rev
  }
  const stored = await loadProjectRecord(id)
  if (!stored) {
    deletedElsewhere(id, true)
    return
  }
  show(id, stored.rev, stored.project)
  toast.warning(
    t(
      'This project was changed in another tab and has been reloaded. Your last change was not saved.'
    )
  )
}

/** Writes the latest copy of `id` once the save of it still running is done. */
function queueWrite(uid: number, id: string): Promise<void> {
  const next = (writes.get(id) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => write(uid, id))
  writes.set(id, next)
  const forget = () => {
    if (writes.get(id) === next) writes.delete(id)
  }
  next.then(forget, forget).catch(() => undefined)
  return next
}

function save(uid: number, id: string) {
  queueWrite(uid, id)
    .then(() => savedOk(uid, id))
    .catch(() => saveFailed(id))
}

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
      save(uid, p.id)
    }, wait),
  })
}

/** Writes everything pending right away (the tab is being hidden or closed). */
function flush() {
  const s = useBearDrawStore.getState()
  if (s.uid == null) return
  for (const [id, timer] of timers) {
    clearTimeout(timer.t)
    save(s.uid, id)
  }
  timers.clear()
}

/** Reads a project another tab stored, unless this tab has its own change coming. */
async function reload(uid: number, id: string) {
  const record = await loadProjectRecord(id)
  const s = useBearDrawStore.getState()
  if (s.uid !== uid || timers.has(id) || writes.has(id) || busyHere(id)) return
  if (!record) {
    deletedElsewhere(id, false)
    return
  }
  if (record.uid !== uid || bases.get(id)?.rev === record.rev) return
  show(id, record.rev, record.project)
}

function onOtherTab(news: ProjectNews) {
  const s = useBearDrawStore.getState()
  if (!s.loaded || s.uid == null) return
  if (news.uid != null && news.uid !== s.uid) return
  if (news.rev != null && bases.get(news.id)?.rev === news.rev) return
  // A change of ours still to be saved merges with theirs then, and a
  // reply being written here is not cut off.
  if (timers.has(news.id) || writes.has(news.id) || busyHere(news.id)) return
  if (news.rev == null) {
    deletedElsewhere(news.id, false)
    return
  }
  // Still working there: its pictures would show as lost here. Its last
  // save is announced as not busy.
  if (news.busy) return
  void reload(s.uid, news.id).catch(() => undefined)
}

function watch() {
  if (unsubscribe) return
  unsubscribe = useBearDrawStore.subscribe((state, prev) => {
    // loading a user's projects (or another user's) is not an edit
    if (state.projects === prev.projects || state.uid == null) return
    if (!prev.loaded || state.uid !== prev.uid) return
    const before = new Map(prev.projects.map((p) => [p.id, p]))
    for (const p of state.projects) {
      // a stored copy just shown is not an edit either
      const edited = before.get(p.id) !== p && bases.get(p.id)?.view !== p
      if (edited) scheduleSave(state.uid, p)
      before.delete(p.id)
    }
    // whatever is left was deleted; deleteProject removes its record
    for (const id of before.keys()) {
      const pending = timers.get(id)
      if (pending) clearTimeout(pending.t)
      timers.delete(id)
      unsaved.delete(id)
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
  listenToOtherTabs(onOtherTab)
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
      const records = await loadProjectRecords(uid)
      const have = new Set(records.map((r) => r.project.id))
      const copies = (await classicRooms(uid)).filter((p) => !have.has(p.id))
      if (cancelled) return
      bases.clear()
      const projects = records.map((r) => {
        const view = settleProject(r.project)
        bases.set(view.id, { rev: r.rev, raw: r.project, view })
        return view
      })
      const store = useBearDrawStore.getState()
      store.init(uid, [...projects, ...copies])
      // A card left waiting before the reload still waits for the user.
      for (const p of projects) {
        const waiting = p.messages.some(
          (m) => m.role === 'agent' && m.status === 'waiting'
        )
        if (waiting) store.setLive(p.id, { phase: 'wait', since: Date.now() })
      }
      // A copy that can't be written (full storage) stays for this visit and
      // is copied again next time; the projects already loaded are kept.
      const saved = await Promise.allSettled(
        copies.map((p) => queueWrite(uid, p.id))
      )
      if (saved.every((r) => r.status === 'fulfilled')) markMigrated(uid)
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

  const ready = loadedUid === uid && !failed
  useEffect(() => {
    if (!ready || !uid) return
    return scheduleImageSweep(uid)
  }, [ready, uid])

  if (failed) return 'unavailable'
  return loadedUid === uid ? 'ready' : 'loading'
}
