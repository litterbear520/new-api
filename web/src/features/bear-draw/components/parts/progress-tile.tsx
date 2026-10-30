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
import { Square, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useImageUrl } from '@/features/draw/hooks/use-image-url'
import { useMoney } from '@/features/draw/hooks/use-money'
import { useNow } from '@/features/draw/hooks/use-now'
import { cn } from '@/lib/utils'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { retryPicture } from '../../lib/engine'
import { halftonePhase } from '../../lib/halftone'
import type { ProgressItem } from '../../types'
import { sizeAspect } from './format'
import { useHalftone } from './use-halftone'

/** Shape of the tile: the picture, else the delivery size, else the frame. */
function useTileAspect(projectId: string, it: ProgressItem): string {
  const frame = useBearDrawStore((s) => {
    const node = s.projects
      .find((p) => p.id === projectId)
      ?.nodes.find((n) => n.id === it.nodeId)
    return node ? `${node.w} / ${node.h}` : null
  })
  if (it.img) return `${it.img.w} / ${it.img.h}`
  return sizeAspect(it.size) ?? frame ?? '1 / 1'
}

/** 「开始画」→「画细节」→「收尾」, refreshed every second while drawing. */
function DrawingWord(props: { item: ProgressItem }) {
  const { t } = useTranslation()
  const now = useNow(true, 1000)
  const it = props.item
  const secs = (now - (it.startedAt ?? now)) / 1000
  const phase = halftonePhase(secs, it.model, it.edit)
  if (phase === 'start') return t('Starting')
  if (phase === 'details') return t('Adding details')
  if (phase === 'finish') return t('Finishing up')
  return t('Slower than usual, still drawing')
}

function CaptionRight(props: { item: ProgressItem }) {
  const { t } = useTranslation()
  const money = useMoney()
  const it = props.item
  switch (it.status) {
    case 'done': {
      const bits = [
        it.secs != null ? t('{{count}} s', { count: it.secs }) : '',
        it.cost != null ? money.cost(it.cost) : '',
      ]
      return bits.filter(Boolean).join(' · ')
    }
    case 'drawing':
      return <DrawingWord item={it} />
    case 'queued':
      return t('Queued')
    case 'stopped':
      return t('Stopped · not charged')
    case 'lost':
      return t('Not finished')
    default:
      return t('Failed · not charged')
  }
}

/** Why a picture was not drawn, in the classic page's words. */
function useReason(it: ProgressItem): string | null {
  const { t } = useTranslation()
  if (it.status === 'stopped') return null
  if (it.status === 'lost') {
    return t('The page closed before this picture finished')
  }
  switch (it.error?.kind) {
    case 'moderation':
      return t('This description did not pass content review')
    case 'balance':
      return t('Not enough balance for this picture')
    case 'auth':
      return t('The drawing token is unavailable')
    case 'unreadable':
      return t('A picture you attached can no longer be read')
    case 'busy':
      return t('The server is busy; this picture was not drawn')
    default:
      return t('This picture was not drawn')
  }
}

/** A failed, lost or stopped picture: why, and a way to draw it again. */
function TileProblem(props: {
  projectId: string
  item: ProgressItem
  aspect: string
}) {
  const { t } = useTranslation()
  const it = props.item
  const reason = useReason(it)
  const stopped = it.status === 'stopped'
  const Icon = stopped ? Square : TriangleAlert
  return (
    <div
      className='bd-tile-box bd-tile-prob'
      style={{ aspectRatio: props.aspect }}
      title={reason ?? undefined}
    >
      <Icon className='bd-tile-pi' aria-hidden='true' />
      {reason && <span className='bd-tile-why'>{reason}</span>}
      {it.job && (
        <Button
          type='button'
          size='xs'
          variant='outline'
          className='bd-tile-retry'
          aria-label={
            stopped
              ? t('Draw “{{label}}”', { label: it.label })
              : t('Retry “{{label}}”', { label: it.label })
          }
          onClick={() => retryPicture(props.projectId, it.nodeId)}
        >
          {stopped ? t('Draw it') : t('Retry')}
        </Button>
      )}
    </div>
  )
}

/**
 * One picture of a set in the chat: the dot screen while it waits or
 * draws, the picture once done (click to see it on the canvas), or why it
 * was not drawn with 重试.
 */
export function ProgressTile(props: {
  projectId: string
  item: ProgressItem
  index: number
  onOpen: (nodeId: string) => void
}) {
  const { t } = useTranslation()
  const it = props.item
  const aspect = useTileAspect(props.projectId, it)
  const { hostRef, shown } = useHalftone(it, props.index)
  const url = useImageUrl(shown ? it.img?.id : undefined, 'thumb')
  const problem =
    it.status === 'failed' || it.status === 'lost' || it.status === 'stopped'
  return (
    <div className={cn('bd-tile', `is-${it.status}`)}>
      {problem ? (
        <TileProblem projectId={props.projectId} item={it} aspect={aspect} />
      ) : (
        <button
          type='button'
          className='bd-tile-box'
          style={{ aspectRatio: aspect }}
          aria-label={t('{{label}}, show on the canvas', { label: it.label })}
          onClick={() => props.onOpen(it.nodeId)}
        >
          <span ref={hostRef} className='bd-tile-ht' aria-hidden='true' />
          {shown && url && <img src={url} alt='' draggable={false} />}
        </button>
      )}
      <div className='bd-tile-cap'>
        <b>{it.label}</b>
        <span className='bd-tile-r bd-num'>
          <CaptionRight item={it} />
        </span>
      </div>
    </div>
  )
}
