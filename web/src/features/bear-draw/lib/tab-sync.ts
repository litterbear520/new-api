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
/*
 * Tells the other tabs of this browser that a stored project changed, so a
 * tab showing it (or the project list) can read it again. Browsers without
 * BroadcastChannel rely on the version check when saving
 * (lib/storage.ts saveProject).
 */

export type ProjectNews = {
  id: string
  /** The stored version; null when the project was deleted. */
  rev: number | null
  uid?: number
  /** The tab that saved it is still working on it (agent or pictures). */
  busy?: boolean
}

const NAME = 'bear-draw.projects'

let channel: BroadcastChannel | null = null
let listener: ((news: ProjectNews) => void) | null = null
let pageEvents = false

function parse(data: unknown): ProjectNews | null {
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (typeof d.id !== 'string') return null
  if (d.rev !== null && typeof d.rev !== 'number') return null
  return {
    id: d.id,
    rev: d.rev,
    uid: typeof d.uid === 'number' ? d.uid : undefined,
    busy: d.busy === true,
  }
}

function open(): BroadcastChannel | null {
  if (channel) return channel
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    channel = new BroadcastChannel(NAME)
  } catch {
    return null
  }
  channel.addEventListener('message', (e: MessageEvent) => {
    const news = parse(e.data)
    if (news && listener) listener(news)
  })
  return channel
}

function close() {
  channel?.close()
  channel = null
}

/** Sends `news` to the other tabs (nothing happens without BroadcastChannel). */
export function announce(news: ProjectNews): void {
  try {
    open()?.postMessage(news)
  } catch {
    // A closing page: the version check still guards the next save.
  }
}

/** Calls `fn` for every change another tab announces. */
export function listenToOtherTabs(fn: (news: ProjectNews) => void): void {
  listener = fn
  open()
  if (pageEvents || typeof window === 'undefined') return
  pageEvents = true
  // An open channel can keep the page out of the back/forward cache.
  window.addEventListener('pagehide', close)
  window.addEventListener('pageshow', () => {
    if (listener) open()
  })
}
