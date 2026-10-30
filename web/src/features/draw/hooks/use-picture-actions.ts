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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

import { MAX_PENDING } from '../constants'
import { drawAgain } from '../lib/actions'
import { copyImageToClipboard, downloadImage } from '../lib/images'
import type { DrawItem, DrawRoom } from '../types'

/** Download, copy and "draw another", with their messages. */
export function usePictureActions() {
  const { t } = useTranslation()
  const copier = useCopyToClipboard({ successMessage: t('Description copied') })

  return {
    download: (imageId: string) => {
      downloadImage(imageId).catch(() =>
        toast.error(t('This picture is no longer in this browser'))
      )
    },
    copyPrompt: (item: DrawItem) => {
      void copier.copyToClipboard(item.req.text)
    },
    copyImage: (imageId: string) => {
      copyImageToClipboard(imageId)
        .then(() => toast.success(t('Picture copied')))
        .catch(() =>
          toast.error(
            t('This browser can’t copy pictures; download it instead')
          )
        )
    },
    again: (room: DrawRoom, item: DrawItem) => {
      if (!drawAgain(room, item)) {
        toast(
          t('Up to {{count}} pictures at once; try again when one finishes', {
            count: MAX_PENDING,
          })
        )
      }
    },
  }
}
