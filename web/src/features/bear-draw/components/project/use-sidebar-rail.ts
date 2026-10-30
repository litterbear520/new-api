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
import { useEffect, useLayoutEffect, useState } from 'react'

import { useSidebar } from '@/components/ui/sidebar'

/**
 * Set while the sidebar is folded by a project (the sidebar keeps its own
 * state in a cookie, so after a reload inside a project it starts folded
 * and only this mark says the fold was ours).
 */
export const RAIL_MARK = 'bear-draw.rail'

function marked(): boolean {
  try {
    return localStorage.getItem(RAIL_MARK) === '1'
  } catch {
    return false
  }
}

function mark(on: boolean): void {
  try {
    if (on) localStorage.setItem(RAIL_MARK, '1')
    else localStorage.removeItem(RAIL_MARK)
  } catch {
    // Without storage a reload inside a project keeps the sidebar folded.
  }
}

/** A restore waiting one tick, cancelled when a project page mounts again. */
let pendingRestore = 0

/**
 * While a project is open the console sidebar folds to its icon rail, so
 * the chat and the canvas get the room. Leaving the project unfolds it
 * again, unless the user opened or closed it themselves in the meantime.
 */
export function useSidebarRail(): void {
  const sidebar = useSidebar()
  const [box] = useState(() => ({
    sidebar,
    /** What we set it to; null while we are not managing it. */
    expected: null as boolean | null,
    /** The user toggled it after we folded it. */
    touched: false,
  }))

  useLayoutEffect(() => {
    box.sidebar = sidebar
  })

  useEffect(() => {
    if (box.expected != null && sidebar.open !== box.expected) {
      box.touched = true
      mark(false)
    }
  }, [box, sidebar.open])

  useEffect(() => {
    window.clearTimeout(pendingRestore)
    const s = box.sidebar
    if (s.isMobile) return
    // folded by the user, not by a project: leave it alone
    if (!s.open && !marked()) return
    box.expected = false
    box.touched = false
    mark(true)
    if (s.open) s.setOpen(false)
    return () => {
      box.expected = null
      if (box.touched) return
      // after a tick, so the next project (or React's dev re-mount) keeps the rail
      pendingRestore = window.setTimeout(() => {
        mark(false)
        box.sidebar.setOpen(true)
      }, 0)
    }
  }, [box])
}
