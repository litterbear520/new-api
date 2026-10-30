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
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { MAX_REFS } from '../../constants'
import { storeAttachments } from '../../lib/engine'
import type { Attachment } from '../../types'

export const isImageFile = (f: File) => f.type.startsWith('image/')

/**
 * The pictures attached to the message being written: uploaded, pasted,
 * dropped or taken from the canvas. At most MAX_REFS; a toast says so.
 */
export function useAttachments() {
  const { t } = useTranslation()
  const [refs, setRefs] = useState<Attachment[]>([])
  // the latest list, also between a store call and its answer
  const latest = useRef<Attachment[]>([])

  const set = useCallback((next: Attachment[]) => {
    latest.current = next
    setRefs(next)
  }, [])

  const tooMany = useCallback(() => {
    toast(t('Up to {{count}} pictures per message', { count: MAX_REFS }))
  }, [t])

  /** Adds pictures; ones already attached are skipped. False when none fit. */
  const add = useCallback(
    (list: Attachment[]): boolean => {
      const cur = latest.current
      const fresh = list.filter((a) => !cur.some((r) => r.id === a.id))
      const room = MAX_REFS - cur.length
      if (fresh.length > room) tooMany()
      if (room <= 0) return false
      if (fresh.length) set([...cur, ...fresh.slice(0, room)])
      return true
    },
    [set, tooMany]
  )

  /** Stores picked, pasted or dropped files and attaches them. */
  const addFiles = useCallback(
    async (files: File[]) => {
      const pictures = files.filter(isImageFile)
      if (!pictures.length) {
        if (files.length) toast(t('Only pictures can be added here'))
        return
      }
      const room = MAX_REFS - latest.current.length
      if (room <= 0) {
        tooMany()
        return
      }
      if (pictures.length > room) tooMany()
      let stored: Attachment[]
      try {
        stored = await storeAttachments(pictures.slice(0, room))
      } catch {
        toast.error(t("Couldn't read that picture; try another one"))
        return
      }
      add(stored)
    },
    [add, t, tooMany]
  )

  const remove = useCallback(
    (id: string) => set(latest.current.filter((r) => r.id !== id)),
    [set]
  )

  const clear = useCallback(() => set([]), [set])

  return useMemo(
    () => ({ refs, add, addFiles, remove, clear }),
    [refs, add, addFiles, remove, clear]
  )
}
