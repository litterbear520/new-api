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
import { ChevronLeft, ChevronRight, Copy, Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { roomItems } from '@/stores/draw-store'

import { useGlass } from '../hooks/use-glass'
import { useImageUrl } from '../hooks/use-image-url'
import { usePictureActions } from '../hooks/use-picture-actions'
import type { DrawRoom } from '../types'
import type { LightboxTarget } from './draw-context'
import { Tip } from './tip'

const DARK_GLASS = {
  bezel: 18,
  depth: 8,
  frost: 6,
  tint: [0.3, 0.45] as [number, number],
  dark: true,
}

function RoundButton(props: {
  label: string
  className: string
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  close?: boolean
}) {
  const glass = useGlass<HTMLButtonElement>(DARK_GLASS)
  const button = (
    <button
      ref={glass}
      type='button'
      className={cn('dw-round dw-glass', props.className)}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
  return (
    <Tip label={props.label}>
      {props.close ? <DialogClose render={button} /> : button}
    </Tip>
  )
}

/** Full-screen view of the conversation's pictures (← → to move, Esc to close). */
export function Lightbox(props: {
  room: DrawRoom
  target: LightboxTarget | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const acts = usePictureActions()
  const barGlass = useGlass<HTMLDivElement>({
    bezel: 18,
    depth: 10,
    frost: 7,
    tint: [0.3, 0.5],
    dark: true,
  })
  const gallery = roomItems(props.room).filter((it) => it.img)
  const [index, setIndex] = useState(0)
  const target = props.target
  const single = target && 'imageId' in target ? target : null

  useEffect(() => {
    if (target && 'item' in target) {
      setIndex(
        Math.max(
          0,
          gallery.findIndex((it) => it.id === target.item.id)
        )
      )
    }
    // gallery is read when the target changes
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  const item = single ? null : gallery[index]
  const imageId = single ? single.imageId : item?.img?.id
  const url = useImageUrl(imageId, 'full')
  const step = (d: number) =>
    setIndex((i) => Math.min(gallery.length - 1, Math.max(0, i + d)))

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(open) => !open && props.onClose()}
    >
      <DialogContent
        showCloseButton={false}
        className='dw-lb top-0 left-0 h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 rounded-none bg-transparent p-0 ring-0 sm:max-w-none'
        onKeyDown={(e) => {
          if (single) return
          if (e.key === 'ArrowLeft') step(-1)
          if (e.key === 'ArrowRight') step(1)
        }}
      >
        <DialogTitle className='sr-only'>{t('View full screen')}</DialogTitle>
        <div
          className='dw-lb-stage'
          onClick={(e) => e.target === e.currentTarget && props.onClose()}
        >
          {url && (
            <img
              src={url}
              alt={item ? item.req.text : t('Reference picture')}
              className={cn(
                (item?.img?.clear || (single && single.clear)) && 'dw-clear'
              )}
            />
          )}
        </div>
        <RoundButton label={t('Close (Esc)')} className='dw-lb-x' close>
          <X />
        </RoundButton>
        {!single && gallery.length > 1 && (
          <>
            <RoundButton
              label={t('Previous (←)')}
              className='dw-lb-prev'
              disabled={index === 0}
              onClick={() => step(-1)}
            >
              <ChevronLeft />
            </RoundButton>
            <RoundButton
              label={t('Next (→)')}
              className='dw-lb-next'
              disabled={index === gallery.length - 1}
              onClick={() => step(1)}
            >
              <ChevronRight />
            </RoundButton>
          </>
        )}
        <div ref={barGlass} className='dw-lb-bar dw-glass'>
          {!single && (
            <span className='dw-cnt tabular-nums'>{`${index + 1} / ${gallery.length}`}</span>
          )}
          {imageId && (
            <button type='button' onClick={() => acts.download(imageId)}>
              <Download aria-hidden='true' />
              <span>{t('Download')}</span>
            </button>
          )}
          {item && (
            <button type='button' onClick={() => acts.copyPrompt(item)}>
              <Copy aria-hidden='true' />
              <span>{t('Copy description')}</span>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
