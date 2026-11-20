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
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { blobToDataUrl, fullImageBlob } from '@/features/draw/lib/images'

import {
  openSaveSheet,
  type SavePicture,
  shownPictures,
  subscribeSaveSheet,
} from './save-sheet-state'

/*
 * 下载 inside WeChat and QQ: their browsers ignore download links, so the
 * pictures open here and the user saves them with a long press. They show
 * as data URLs: the apps' long-press menu can't fetch a blob: URL.
 */

async function dataUrl(id: string): Promise<string | null> {
  const blob = await fullImageBlob(id).catch(() => null)
  return blob ? blobToDataUrl(blob).catch(() => null) : null
}

export function SaveSheet() {
  const { t } = useTranslation()
  const pictures = useSyncExternalStore(
    subscribeSaveSheet,
    shownPictures,
    shownPictures
  )
  const [loaded, setLoaded] = useState<{
    of: SavePicture[]
    urls: (string | null)[]
  } | null>(null)

  useEffect(() => {
    if (!pictures.length) return
    let live = true
    void Promise.all(pictures.map((p) => dataUrl(p.id))).then((urls) => {
      if (live) setLoaded({ of: pictures, urls })
    })
    return () => {
      live = false
    }
  }, [pictures])

  const urls = loaded?.of === pictures ? loaded.urls : null

  return (
    <Dialog
      open={pictures.length > 0}
      onOpenChange={(open) => {
        if (!open) openSaveSheet([])
      }}
      title={t('Save pictures')}
      description={t('Press and hold a picture to save it.')}
    >
      <div className='flex flex-col gap-3'>
        {pictures.map((p, i) => {
          const url = urls?.[i]
          if (urls && !url) {
            return (
              <p key={p.id} className='text-muted-foreground text-sm'>
                {t('Download failed')}
              </p>
            )
          }
          return url ? (
            <img
              key={p.id}
              src={url}
              alt={p.label}
              className='h-auto w-full rounded-md'
            />
          ) : (
            <div
              key={p.id}
              className='bg-muted w-full animate-pulse rounded-md'
              style={{ aspectRatio: `${p.w} / ${p.h}` }}
            />
          )
        })}
      </div>
    </Dialog>
  )
}
