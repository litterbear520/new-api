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
import { useEffect } from 'react'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { send } from '../../lib/engine'

/**
 * Opening a project: a message written on the home page (the store's
 * draft) is sent once, into this project if it is still empty; otherwise
 * the composer gets the focus.
 */
export function useFirstSend(projectId: string, focus: () => void): void {
  useEffect(() => {
    const store = useBearDrawStore.getState()
    const draft = store.draft
    const project = store.projects.find((p) => p.id === projectId)
    if (draft && project && project.messages.length === 0) {
      store.setDraft(null)
      send(projectId, draft)
      return
    }
    const timer = window.setTimeout(focus, 60)
    return () => window.clearTimeout(timer)
  }, [projectId, focus])
}
