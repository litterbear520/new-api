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
import { useState } from 'react'

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

/**
 * A copy button on the home page, which says what happened in its own label
 * instead of a toast: 复制, then 已复制 for a moment, or 请手动复制 when the
 * browser lets nothing copy. The home page is Chinese only. `status` is the
 * same result for a status region beside the button (empty until a copy):
 * a live region on the button itself is not reliably read out.
 */
export function useCopyLabel(text: string) {
  const { copiedText, copyToClipboard } = useCopyToClipboard({
    notify: false,
    resetAfterMs: 1600,
  })
  const [failedText, setFailedText] = useState<string | null>(null)

  const copy = async () => {
    // cleared first, so a second failure is read out again
    setFailedText(null)
    const copied = await copyToClipboard(text)
    setFailedText(copied ? null : text)
  }

  let label = '复制'
  if (copiedText === text) label = '已复制'
  else if (failedText === text) label = '请手动复制'
  return { label, status: label === '复制' ? '' : label, copy }
}
