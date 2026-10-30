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
import {
  Copy,
  Download,
  FileText,
  Images,
  Maximize2,
  Pencil,
} from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { baseItem } from '@/stores/draw-store'

import { MAX_IMAGES } from '../constants'
import { usePictureActions } from '../hooks/use-picture-actions'
import { addReference, editItem } from '../lib/actions'
import type { DrawItem, DrawRoom } from '../types'
import { useDrawPage } from './draw-context'

type ImageMenuProps = {
  room: DrawRoom
  item: DrawItem
  /** Extra price for using it as a reference, e.g. "$0.012". */
  refPrice: string
  children: ReactElement
}

/** Right-click (or long-press) a picture: edit, reference, download, copy (Lovart). */
export function ImageMenu(props: ImageMenuProps) {
  const { t } = useTranslation()
  const ctx = useDrawPage()
  const acts = usePictureActions()
  const img = props.item.img
  if (!img) return props.children
  const isBase = baseItem(props.room)?.id === props.item.id

  return (
    <ContextMenu>
      <ContextMenuTrigger render={props.children} />
      <ContextMenuContent className='w-[240px]'>
        {!isBase && (
          <ContextMenuItem
            className='dw-mi'
            onClick={() => {
              editItem(props.room, props.item)
              ctx.focusComposer()
            }}
          >
            <Pencil />
            <span className='dw-mi-tx'>
              <span>{t('Edit this one next')}</span>
              <small>{t('Say how in the box below')}</small>
            </span>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          className='dw-mi'
          onClick={() => {
            if (!addReference(props.room, props.item)) {
              toast(t('Up to {{count}} pictures', { count: MAX_IMAGES }))
              return
            }
            ctx.focusComposer()
          }}
        >
          <Images />
          <span className='dw-mi-tx'>
            <span>{t('Use as a reference')}</span>
            {props.refPrice && (
              <small>
                {t('about {{price}} more', { price: props.refPrice })}
              </small>
            )}
          </span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => acts.download(img.id)}>
          <Download />
          {t('Download')}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => acts.copyImage(img.id)}>
          <Copy />
          {t('Copy picture')}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => acts.copyPrompt(props.item)}>
          <FileText />
          {t('Copy description')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => ctx.openLightbox({ item: props.item })}>
          <Maximize2 />
          {t('View full screen')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
