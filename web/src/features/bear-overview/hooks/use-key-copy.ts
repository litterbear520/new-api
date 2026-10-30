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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { fetchTokenKey } from '@/features/keys/api'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { handleServerError } from '@/lib/handle-server-error'

/**
 * Copies text that may contain the real key. The key list only has masked
 * keys, so the full one is fetched at the moment of copying and never kept.
 * `copiedId` names what was copied last, for two seconds.
 */
export function useKeyCopy() {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard({ notify: false })
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(
    async (
      id: string,
      keyId: number | null,
      build: (key: string) => string
    ) => {
      setBusyId(id)
      try {
        let key = ''
        if (keyId) {
          const res = await fetchTokenKey(keyId)
          if (!res.success || !res.data?.key) {
            handleServerError(res, t('Failed to copy to clipboard'))
            return
          }
          key = `sk-${res.data.key}`
        }
        if (!(await copyToClipboard(build(key)))) {
          toast.error(t('Failed to copy to clipboard'))
          return
        }
        setCopiedId(id)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopiedId(null), 2000)
      } catch (error) {
        handleServerError(error, t('Failed to copy to clipboard'))
      } finally {
        setBusyId(null)
      }
    },
    [copyToClipboard, t]
  )

  return { copy, copiedId, busyId }
}
