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
import { useEffect, useRef } from 'react'

import { useSidebar } from '@/components/ui/sidebar'

import { RAIL_MARK } from '../components/project/use-sidebar-rail'

/*
 * A project folds the console sidebar and unfolds it when left. If the tab
 * was closed inside a project, the fold outlives the visit (the sidebar
 * keeps its state in a cookie); the home page and the library undo it.
 */
export function useRailRestore(inProject: boolean) {
  const sidebar = useSidebar()
  const ref = useRef(sidebar)
  ref.current = sidebar
  // only when entering a view without a project
  useEffect(() => {
    const s = ref.current
    if (inProject || s.isMobile) return
    let ours = false
    try {
      ours = localStorage.getItem(RAIL_MARK) === '1'
      if (ours) localStorage.removeItem(RAIL_MARK)
    } catch {
      ours = false
    }
    if (ours && !s.open) s.setOpen(true)
  }, [inProject])
}
