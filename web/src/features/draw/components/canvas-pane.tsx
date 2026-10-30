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
import { ArrowLeft, PanelRightClose } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import {
  findItem,
  roomItems,
  selectedItem,
  useDrawStore,
} from '@/stores/draw-store'

import { useGlass } from '../hooks/use-glass'
import { useImageUrl } from '../hooks/use-image-url'
import { useMoney } from '../hooks/use-money'
import { useNow } from '../hooks/use-now'
import { finishMarking } from '../lib/actions'
import { itemAspect } from '../lib/reveal'
import type { DrawItem, DrawRoom, MarkStroke } from '../types'
import { BellPopover } from './bell-popover'
import { CanvasToolbar, Filmstrip, ReadyPill } from './canvas-parts'
import { ComparePair, CompareSlider } from './compare-view'
import { useDrawPage } from './draw-context'
import { MarkLayer } from './mark-layer'
import { ErrorCard } from './message-parts'
import { RevealImage } from './reveal-image'
import { Scene } from './scene'
import { Tip } from './tip'

const CAPTION_H = 32

/** Under the waiting pill: honest words about the wait, never a fake percentage. */
function WaitHint(props: { item: DrawItem }) {
  const { t } = useTranslation()
  const rooms = useDrawStore((s) => s.rooms)
  const now = useNow(true, 1000)
  const secs = Math.floor((now - props.item.start) / 1000)
  const edit = props.item.req.imgs.some((img) => img.kind === 'base')
  const avg = useMemo(() => {
    const xs = rooms
      .flatMap(roomItems)
      .filter(
        (it) => it.img && it.secs && it.req.model === props.item.req.model
      )
      .map((it) => it.secs ?? 0)
    return xs.length >= 3
      ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
      : 0
  }, [rooms, props.item.req.model])
  let text = edit
    ? t('Edits usually take about a minute')
    : t('Usually 20–40 seconds')
  if (avg) {
    text = t('Your recent average with this model: {{count}} s', { count: avg })
  }
  if (secs >= 60) {
    text = edit
      ? t('Taking a bit longer than usual, still editing')
      : t('Taking a bit longer than usual, still drawing')
  }
  if (secs >= 120) {
    text = t(
      'It is slower when many people are drawing. You can visit other pages; the sidebar shows a red dot when it’s done.'
    )
  }
  return <small aria-live='off'>{text}</small>
}

function useStageBox(ref: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() =>
      setBox({ w: el.clientWidth, h: el.clientHeight })
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return box
}

export function CanvasPane(props: { room: DrawRoom; onClose?: () => void }) {
  const { t } = useTranslation()
  const ctx = useDrawPage()
  const money = useMoney()
  const room = props.room
  const mode = useDrawStore((s) => s.mode)
  const cmp = useDrawStore((s) => s.cmp)
  const setMode = useDrawStore((s) => s.setMode)
  const updateItem = useDrawStore((s) => s.updateItem)
  const [strokes, setStrokes] = useState<MarkStroke[]>([])
  const stageRef = useRef<HTMLDivElement>(null)
  const box = useStageBox(stageRef)
  const items = roomItems(room)
  const sel = selectedItem(room)
  const hideGlass = useGlass<HTMLButtonElement>({
    bezel: 18,
    depth: 8,
    frost: 4,
    tint: [0.4, 0.6],
  })
  const closeGlass = useGlass<HTMLButtonElement>({
    bezel: 18,
    depth: 8,
    frost: 4,
    tint: [0.4, 0.6],
  })
  const ambUrl = useImageUrl(
    sel?.img?.id ?? sel?.req.imgs.find((img) => img.kind === 'base')?.id,
    'thumb'
  )

  // A finished picture ripples in the first time the canvas shows it.
  useEffect(() => {
    if (sel?.img && sel.unseen) {
      updateItem(room.id, sel.id, { unseen: false, cvAt: Date.now() })
    }
  }, [room.id, sel?.id, sel?.img, sel?.unseen, updateItem])

  useEffect(() => {
    if (mode && !sel?.img) setMode(null)
  }, [mode, sel?.img, setMode])

  const [aw, ah] = sel ? itemAspect(sel) : [1, 1]
  const ar = aw / ah
  const availH = Math.max(0, box.h - CAPTION_H)
  const fw = Math.max(0, Math.min(box.w, availH * ar))
  const fh = fw / ar
  const pendingNew =
    sel?.status === 'pending' &&
    !sel.req.imgs.some((img) => img.kind === 'base')
  const ready = [...items]
    .reverse()
    .find((it) => it.unseen && it.img && it.id !== sel?.id)

  const finishMarks = () => {
    if (!sel) return
    if (!strokes.length) {
      toast(t('Circle the area to change first'))
      return
    }
    const n = strokes.length
    finishMarking(room, sel, strokes)
      .then(() => {
        setStrokes([])
        toast(
          n > 1
            ? t('{{count}} areas circled; say how to change each by number', {
                count: n,
              })
            : t('Added to the box; say how to change it')
        )
        ctx.focusComposer()
      })
      .catch(() => toast.error(t('This picture is no longer in this browser')))
  }

  let stage = null
  if (sel?.status === 'pending') {
    stage = (
      <>
        <div
          className='dw-frame dw-wait'
          style={{ width: fw, height: fh }}
          role='status'
        >
          <Scene
            item={sel}
            size='big'
            extra={
              <>
                <WaitHint item={sel} />
                <BellPopover variant='link' />
              </>
            }
          />
        </div>
        <div className='dw-cap'>
          {t(
            'You can visit other pages while it draws, but don’t close or reload the tab, or the picture is lost and still charged.'
          )}
        </div>
      </>
    )
  } else if (sel?.status === 'error') {
    stage = <ErrorCard room={room} item={sel} variant='canvas' />
  } else if (sel?.img && mode === 'compare') {
    const other = findItem(room, cmp)
    if (!other?.img) {
      stage = (
        <>
          <div className='dw-frame' style={{ width: fw, height: fh }}>
            <RevealImage item={sel} size='big' variant='full' w={fw} h={fh} />
          </div>
          <div className='dw-cap'>
            {t('Pick one in the row below to compare with this one')}
          </div>
        </>
      )
    } else {
      const index = (it: DrawItem) => items.indexOf(it) + 1
      const before = other.id === sel.parent
      const leftLabel = before
        ? t('Before')
        : t('Picture {{n}}', { n: index(other) })
      const rightLabel = before
        ? t('After')
        : t('Picture {{n}}', { n: index(sel) })
      const same =
        Math.abs(other.img.w / other.img.h - sel.img.w / sel.img.h) < 0.02
      if (same) {
        stage = (
          <>
            <CompareSlider
              left={other}
              right={sel}
              leftLabel={leftLabel}
              rightLabel={rightLabel}
              w={fw}
              h={fh}
            />
            <div className='dw-cap'>
              {t('Drag the line to see what changed')}
            </div>
          </>
        )
      } else {
        const sum = other.img.w / other.img.h + ar
        const ph = Math.max(0, Math.min(availH - 26, (box.w - 18) / sum))
        stage = (
          <>
            <ComparePair
              left={other}
              right={sel}
              leftLabel={leftLabel}
              rightLabel={rightLabel}
              h={ph}
            />
            <div className='dw-cap'>
              {t('Different sizes, shown side by side')}
            </div>
          </>
        )
      }
    }
  } else if (sel?.img) {
    const marking = mode === 'mark'
    stage = (
      <>
        <div
          className={cn(
            'dw-frame',
            sel.img.clear && 'dw-clear',
            marking && 'dw-marking'
          )}
          style={{ width: fw, height: fh }}
          role={marking ? undefined : 'button'}
          tabIndex={marking ? undefined : 0}
          aria-label={marking ? undefined : t('View full screen')}
          onClick={() => !marking && ctx.openLightbox({ item: sel })}
          onKeyDown={(e) => {
            if (!marking && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              ctx.openLightbox({ item: sel })
            }
          }}
        >
          <RevealImage
            item={sel}
            revealAt={marking ? undefined : sel.cvAt}
            size='big'
            variant='full'
            w={fw}
            h={fh}
            rim
            alt={sel.req.text}
          />
          {marking && (
            <MarkLayer strokes={strokes} onChange={setStrokes} w={fw} h={fh} />
          )}
        </div>
        <div className='dw-cap'>
          <span>{sel.req.model}</span>
          <span className='tabular-nums'>{`${sel.img.w}×${sel.img.h}`}</span>
          {sel.secs != null && (
            <span className='tabular-nums'>
              {t('{{count}} s', { count: sel.secs })}
            </span>
          )}
          {sel.cost != null && (
            <span className='tabular-nums'>{money.cost(sel.cost)}</span>
          )}
        </div>
      </>
    )
  }

  return (
    <section className='dw-canvasp' aria-label={t('Canvas')}>
      <div
        className={cn('dw-amb', pendingNew && 'dw-night')}
        style={
          !pendingNew && ambUrl
            ? { backgroundImage: `url("${ambUrl}")` }
            : undefined
        }
        aria-hidden='true'
      />
      <div className='dw-wash' aria-hidden='true' />
      <div ref={stageRef} className='dw-stage'>
        {box.w > 0 && stage}
      </div>
      {sel?.img && sel.status === 'done' && (
        <CanvasToolbar
          room={room}
          item={sel}
          strokes={strokes}
          onStrokes={setStrokes}
          onFinishMarks={finishMarks}
        />
      )}
      {(items.length > 1 || mode) && <Filmstrip items={items} sel={sel} />}
      {ready && !mode && (
        <ReadyPill item={ready} index={items.indexOf(ready)} />
      )}
      {ctx.narrow ? (
        <button
          ref={closeGlass}
          type='button'
          className='dw-cv-close dw-glass'
          aria-label={t('Back to the conversation')}
          onClick={props.onClose}
        >
          <ArrowLeft />
        </button>
      ) : (
        <Tip label={t('Fold the canvas and keep only the conversation')}>
          <button
            ref={hideGlass}
            type='button'
            className='dw-cv-hide dw-glass'
            aria-label={t('Fold the canvas')}
            onClick={() => ctx.setCanvasOn(false)}
          >
            <PanelRightClose />
          </button>
        </Tip>
      )}
    </section>
  )
}
