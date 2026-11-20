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
import { revokeImageUrls } from '@/features/draw/lib/images'
import {
  allStoredRooms,
  deleteImages,
  storedImageTimes,
} from '@/features/draw/lib/storage'
import { useBearDrawStore } from '@/stores/bear-draw-store'
import { useDrawStore } from '@/stores/draw-store'

import { allProjectRecords } from './storage'

/*
 * Pictures nobody uses any more stay in the picture store: attached and
 * then removed, stored before a broken file in the same pick, drawn for a
 * project deleted meanwhile, kept when a copied project was deleted. Once
 * per visit, while the page is idle, the ones stored over a day ago that
 * nothing mentions are deleted. A picture counts as used when its id
 * appears anywhere in a stored project or classic conversation (any
 * account), in this tab's unsaved state, or in localStorage or
 * sessionStorage (brand kits). Pictures without a stored time, and
 * everything when a read fails, are kept.
 */

export const ORPHAN_AGE = 24 * 60 * 60 * 1000
/** Coming back to the page within this time does not sweep again. */
const SWEEP_GAP = 60 * 60 * 1000
const lastSweep = new Map<number, number>()

/** Ids of the pictures stored over ORPHAN_AGE ago. */
export function oldPictures(
  images: { id: string; at?: number }[],
  now: number
): Set<string> {
  const ids = new Set<string>()
  for (const im of images) {
    if (typeof im.at === 'number' && now - im.at > ORPHAN_AGE) ids.add(im.id)
  }
  return ids
}

/** Takes out of `ids` every id `text` mentions. */
export function dropMentioned(text: string, ids: Set<string>): void {
  for (const id of ids) if (text.includes(id)) ids.delete(id)
}

function storageText(area: Storage): string {
  const parts: string[] = []
  for (let i = 0; i < area.length; i++) {
    const key = area.key(i)
    if (key != null) parts.push(key, area.getItem(key) ?? '')
  }
  return parts.join('\n')
}

/**
 * Deletes this user's pictures that nothing uses; returns their ids.
 * Rejects (deleting nothing) when anything could not be read.
 */
export async function sweepImages(
  uid: number,
  now = Date.now()
): Promise<string[]> {
  const ids = oldPictures(await storedImageTimes(uid), now)
  if (!ids.size) return []
  for (const row of await allProjectRecords()) {
    dropMentioned(JSON.stringify(row), ids)
  }
  for (const row of await allStoredRooms()) {
    dropMentioned(JSON.stringify(row), ids)
  }
  // Read last, right before deleting: edits not stored yet, the new page's
  // draft and brand kit, the classic page's draft and mark.
  dropMentioned(
    JSON.stringify([useBearDrawStore.getState(), useDrawStore.getState()]),
    ids
  )
  dropMentioned(storageText(localStorage), ids)
  dropMentioned(storageText(sessionStorage), ids)
  if (!ids.size) return []
  const gone = [...ids]
  await deleteImages(gone)
  revokeImageUrls(gone)
  return gone
}

/** Sweeps once the page is idle, at most once per visit; returns a cancel. */
export function scheduleImageSweep(uid: number): () => void {
  const last = lastSweep.get(uid)
  if (last != null && Date.now() - last < SWEEP_GAP) return () => {}
  let cancelled = false
  const run = () => {
    if (cancelled) return
    lastSweep.set(uid, Date.now())
    sweepImages(uid).catch(() => undefined)
  }
  // Some Safari versions have no requestIdleCallback.
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: 10_000 })
    return () => {
      cancelled = true
      window.cancelIdleCallback(id)
    }
  }
  const id = setTimeout(run, 3000)
  return () => {
    cancelled = true
    clearTimeout(id)
  }
}
