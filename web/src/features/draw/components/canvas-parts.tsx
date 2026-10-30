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
  ArrowLeft,
  Check,
  CircleAlert,
  Copy,
  Download,
  Eraser,
  Lasso,
  Maximize2,
  RotateCcw,
  SquareSplitHorizontal,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import {
  findItem,
  pendingItems,
  roomItems,
  useDrawStore,
} from '@/stores/draw-store'

import { MAX_PENDING } from '../constants'
import { useGlass } from '../hooks/use-glass'
import { useImageUrl } from '../hooks/use-image-url'
import { usePictureActions } from '../hooks/use-picture-actions'
import { selectItem } from '../lib/actions'
import type { DrawItem, DrawRoom, MarkStroke } from '../types'
import { useDrawPage } from './draw-context'
import { Scene } from './scene'
import { Tip } from './tip'

function ToolButton(props: {
  label: string
  tip?: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  pressed?: boolean
}) {
  return (
    <Tip label={props.tip ?? ''}>
      <button
        type='button'
        className={cn('dw-tb', props.primary && 'dw-primary')}
        aria-label={props.label}
        aria-pressed={props.pressed}
        disabled={props.disabled}
        onClick={props.onClick}
      >
        {props.icon}
        <span className='dw-lbl'>{props.label}</span>
      </button>
    </Tip>
  )
}

function IconTool(props: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tip label={props.label}>
      <button
        type='button'
        className='dw-ib'
        aria-label={props.label}
        disabled={props.disabled}
        onClick={props.onClick}
      >
        {props.icon}
      </button>
    </Tip>
  )
}

type ToolbarProps = {
  room: DrawRoom
  item: DrawItem
  strokes: MarkStroke[]
  onStrokes: (s: MarkStroke[]) => void
  onFinishMarks: () => void
}

export function CanvasToolbar(props: ToolbarProps) {
  const { t } = useTranslation()
  const ctx = useDrawPage()
  const acts = usePictureActions()
  const mode = useDrawStore((s) => s.mode)
  const cmp = useDrawStore((s) => s.cmp)
  const setMode = useDrawStore((s) => s.setMode)
  const full = useDrawStore((s) => pendingItems(s.rooms).length >= MAX_PENDING)
  const glass = useGlass<HTMLDivElement>({
    bezel: 18,
    depth: 14,
    frost: 4,
    tint: [0.38, 0.62],
  })
  const it = props.item
  const many = roomItems(props.room).filter((i) => i.img).length > 1
  const img = it.img
  if (!img) return null

  let content
  if (mode === 'mark') {
    content = (
      <>
        <ToolButton
          label={t('Exit')}
          icon={<ArrowLeft />}
          onClick={() => setMode(null)}
        />
        <span className='dw-hint'>
          {t('Circle what to change; you can circle several places')}
          <kbd>Esc</kbd>
        </span>
        <IconTool
          label={t('Undo')}
          icon={<Undo2 />}
          disabled={!props.strokes.length}
          onClick={() => props.onStrokes(props.strokes.slice(0, -1))}
        />
        <IconTool
          label={t('Clear')}
          icon={<Eraser />}
          disabled={!props.strokes.length}
          onClick={() => props.onStrokes([])}
        />
        <ToolButton
          label={t('Done')}
          icon={<Check />}
          primary
          onClick={props.onFinishMarks}
        />
      </>
    )
  } else if (mode === 'compare') {
    content = (
      <>
        <ToolButton
          label={t('Exit compare')}
          icon={<ArrowLeft />}
          onClick={() => setMode(null)}
        />
        <span className='dw-hint'>
          {cmp
            ? t('Drag the line in the middle')
            : t('Pick one below to compare')}
          <kbd>Esc</kbd>
        </span>
      </>
    )
  } else {
    content = (
      <>
        <ToolButton
          label={t('Draw another')}
          tip={
            full
              ? t('Up to {{count}} pictures at once', { count: MAX_PENDING })
              : t('Draw another with the same description')
          }
          icon={<RotateCcw />}
          disabled={full}
          onClick={() => acts.again(props.room, it)}
        />
        <ToolButton
          label={t('Circle')}
          tip={t('Circle what to change, then say how in the chat')}
          icon={<Lasso />}
          onClick={() => {
            props.onStrokes([])
            setMode('mark')
          }}
        />
        <ToolButton
          label={t('Compare')}
          tip={
            it.parent
              ? t('Compare with the picture before the edit')
              : t('Pick a picture to compare with')
          }
          icon={<SquareSplitHorizontal />}
          disabled={!many}
          onClick={() => {
            const parent = findItem(props.room, it.parent)
            setMode('compare', parent?.img ? parent.id : null)
          }}
        />
        <span className='dw-tsep' />
        <IconTool
          label={t('Copy description')}
          icon={<Copy />}
          onClick={() => acts.copyPrompt(it)}
        />
        <IconTool
          label={t('Download')}
          icon={<Download />}
          onClick={() => acts.download(img.id)}
        />
        <IconTool
          label={t('Full screen')}
          icon={<Maximize2 />}
          onClick={() => ctx.openLightbox({ item: it })}
        />
      </>
    )
  }
  return (
    <div
      ref={glass}
      className='dw-ctool dw-glass'
      role='toolbar'
      aria-label={t('Canvas tools')}
    >
      {content}
    </div>
  )
}

function FilmThumb(props: {
  item: DrawItem
  index: number
  on: boolean
  cmp: boolean
  picking: boolean
}) {
  const { t } = useTranslation()
  const url = useImageUrl(props.item.img?.id, 'thumb')
  const it = props.item
  const edit = it.req.imgs.some((img) => img.kind === 'base')
  let label = t('Picture {{n}}', { n: props.index + 1 })
  if (it.status === 'pending') {
    label = edit
      ? t('Picture {{n}}, editing', { n: props.index + 1 })
      : t('Picture {{n}}, drawing', { n: props.index + 1 })
  } else if (it.status === 'error') {
    label = t('Picture {{n}}, not drawn', { n: props.index + 1 })
  } else if (it.unseen) {
    label = t('Picture {{n}}, just finished', { n: props.index + 1 })
  }
  return (
    <Tip label={label}>
      <button
        type='button'
        className={cn(
          props.on && 'dw-on',
          props.cmp && 'dw-cmpd',
          props.picking && it.img && 'dw-picking',
          it.status === 'pending' && 'dw-pend',
          it.status === 'error' && 'dw-err'
        )}
        role='option'
        aria-selected={props.on}
        aria-label={label}
        onClick={() => selectItem(it.id)}
      >
        {it.status === 'pending' && <Scene item={it} size='tiny' />}
        {it.status === 'error' && <CircleAlert aria-hidden='true' />}
        {it.img && url && <img src={url} alt='' />}
        {it.img && it.unseen && <span className='dw-nd' />}
      </button>
    </Tip>
  )
}

export function Filmstrip(props: { items: DrawItem[]; sel: DrawItem | null }) {
  const { t } = useTranslation()
  const mode = useDrawStore((s) => s.mode)
  const cmp = useDrawStore((s) => s.cmp)
  const glass = useGlass<HTMLDivElement>({
    bezel: 20,
    depth: 14,
    frost: 4,
    tint: [0.32, 0.55],
  })
  const ref = useRef<HTMLDivElement | null>(null)
  const picking = mode === 'compare' && !cmp

  useEffect(() => {
    const el = ref.current
    const on = el?.querySelector<HTMLElement>('.dw-on')
    if (el && on) {
      el.scrollLeft = on.offsetLeft - el.clientWidth / 2 + on.offsetWidth / 2
    }
  }, [props.sel?.id])

  return (
    <div
      ref={(el) => {
        ref.current = el
        glass(el)
      }}
      className='dw-film dw-glass'
      role='listbox'
      aria-label={t('All pictures in this conversation')}
    >
      {props.items.map((it, i) => (
        <FilmThumb
          key={it.id}
          item={it}
          index={i}
          on={it.id === props.sel?.id}
          cmp={mode === 'compare' && it.id === cmp}
          picking={picking}
        />
      ))}
    </div>
  )
}

/** 「第 5 张画好了 · 去看看」 when a picture finished while another was on the canvas. */
export function ReadyPill(props: { item: DrawItem; index: number }) {
  const { t } = useTranslation()
  const url = useImageUrl(props.item.img?.id, 'thumb')
  const setMode = useDrawStore((s) => s.setMode)
  const glass = useGlass<HTMLButtonElement>({
    bezel: 20,
    depth: 10,
    frost: 5,
    tint: [0.5, 0.7],
  })
  return (
    <button
      ref={glass}
      type='button'
      className='dw-cv-new dw-glass'
      onClick={() => {
        setMode(null)
        selectItem(props.item.id)
      }}
    >
      {url && <img src={url} alt='' />}
      <b>{t('Picture {{n}} is ready', { n: props.index + 1 })}</b>
      <span className='dw-go'>{t('Take a look')}</span>
    </button>
  )
}
