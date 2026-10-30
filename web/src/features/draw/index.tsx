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
import { ImageOff, Images } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { LoadingState } from '@/components/loading-state'
import { getCurrencyDisplay } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import {
  currentRoom,
  roomItems,
  selectedItem,
  useDrawStore,
} from '@/stores/draw-store'

import { CanvasPane } from './components/canvas-pane'
import { ChatPane } from './components/chat-pane'
import {
  DrawContext,
  type DrawPageContext,
  type LightboxTarget,
} from './components/draw-context'
import { Lightbox } from './components/lightbox'
import { StartPage } from './components/start-page'
import {
  CHAT_MAX_WIDTH,
  CHAT_MIN_WIDTH,
  MAX_IMAGES,
  NARROW_WIDTH,
  STORAGE_KEYS,
} from './constants'
import { useDrawEnv } from './hooks/use-draw-env'
import { useDrawPersistence } from './hooks/use-draw-persistence'
import { useGlassLight } from './hooks/use-glass'
import { useTabAlerts } from './hooks/use-tab-alerts'
import { addFiles, selectItem } from './lib/actions'
import { refreshBalance } from './lib/generate'
import { disposeGlass } from './lib/glass'

import './draw.css'

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const motionOk = () =>
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode: the layout resets next visit.
  }
}

/** The warped copy that rides the ripple front (SVG turbulence). */
function WarpFilter() {
  return (
    <svg width='0' height='0' className='absolute' aria-hidden='true'>
      <filter
        id='dw-warp'
        x='-5%'
        y='-5%'
        width='110%'
        height='110%'
        colorInterpolationFilters='sRGB'
      >
        <feTurbulence
          type='fractalNoise'
          baseFrequency='.011 .019'
          numOctaves={2}
          seed={7}
          result='n'
        />
        <feDisplacementMap
          in='SourceGraphic'
          in2='n'
          scale={28}
          xChannelSelector='R'
          yChannelSelector='G'
        />
      </filter>
    </svg>
  )
}

function Divider(props: {
  onResize: (w: number) => void
  onDone: () => void
  rootRef: React.RefObject<HTMLDivElement | null>
}) {
  const { t } = useTranslation()
  const [drag, setDrag] = useState(false)
  return (
    <div
      className={cn('dw-divider', drag && 'dw-drag')}
      role='separator'
      aria-orientation='vertical'
      aria-label={t('Drag to resize the conversation')}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        setDrag(true)
      }}
      onPointerMove={(e) => {
        const root = props.rootRef.current
        if (!drag || !root) return
        const r = root.getBoundingClientRect()
        props.onResize(
          clamp(
            e.clientX - r.left,
            CHAT_MIN_WIDTH,
            Math.min(CHAT_MAX_WIDTH, r.width - 360)
          )
        )
      }}
      onPointerUp={() => {
        setDrag(false)
        props.onDone()
      }}
      onPointerCancel={() => setDrag(false)}
    />
  )
}

export function Draw() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const load = useDrawPersistence(user?.id)
  const env = useDrawEnv()
  const room = useDrawStore(currentRoom)
  const mode = useDrawStore((s) => s.mode)
  const setMode = useDrawStore((s) => s.setMode)
  const rootRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  const [canvasOff, setCanvasOff] = useState(
    () => readLocal(STORAGE_KEYS.canvas) === 'off'
  )
  const [showCanvas, setShowCanvas] = useState(false)
  const [chatW, setChatW] = useState(() =>
    clamp(
      Number(readLocal(STORAGE_KEYS.chatWidth)) || 400,
      CHAT_MIN_WIDTH,
      CHAT_MAX_WIDTH
    )
  )
  const [lightbox, setLightbox] = useState<LightboxTarget | null>(null)
  const [dropping, setDropping] = useState(0)
  useTabAlerts()
  useGlassLight(rootRef)

  useEffect(() => () => disposeGlass(), [])

  // the session user may not carry the balance yet
  useEffect(() => {
    void refreshBalance()
  }, [])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() =>
      setNarrow(el.clientWidth < NARROW_WIDTH)
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!narrow) setShowCanvas(false)
  }, [narrow])

  const setCanvasOn = useCallback((on: boolean) => {
    writeLocal(STORAGE_KEYS.canvas, on ? 'on' : 'off')
    const apply = () => setCanvasOff(!on)
    const vt = (
      document as Document & {
        startViewTransition?: (cb: () => void) => unknown
      }
    ).startViewTransition
    if (vt && motionOk()) vt.call(document, () => flushSync(apply))
    else apply()
  }, [])

  const quotaPerUnit = getCurrencyDisplay().config.quotaPerUnit
  const balanceUsd = user?.quota != null ? user.quota / quotaPerUnit : null

  const ctx = useMemo<DrawPageContext>(
    () => ({
      models: env.models,
      pricing: env.pricing,
      groupRatio: env.groupRatio,
      balanceUsd,
      narrow,
      canvasOff,
      setCanvasOn,
      openCanvas: () => setShowCanvas(true),
      openLightbox: setLightbox,
      focusComposer: () => {
        requestAnimationFrame(() =>
          rootRef.current?.querySelector<HTMLTextAreaElement>('.dw-ta')?.focus()
        )
      },
    }),
    [
      env.models,
      env.pricing,
      env.groupRatio,
      balanceUsd,
      narrow,
      canvasOff,
      setCanvasOn,
    ]
  )

  // Esc leaves a canvas mode or the canvas overlay; ← → move between pictures.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightbox) return
      if (e.key === 'Escape') {
        if (mode) setMode(null)
        else setShowCanvas(false)
        return
      }
      const target = e.target as HTMLElement | null
      if (
        target?.closest(
          'input, textarea, [contenteditable], [role="menu"], [role="slider"]'
        )
      ) {
        return
      }
      if (
        room.fresh ||
        mode ||
        (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')
      ) {
        return
      }
      const list = roomItems(room)
      const i = list.findIndex((it) => it.id === selectedItem(room)?.id)
      const j = clamp(i + (e.key === 'ArrowRight' ? 1 : -1), 0, list.length - 1)
      if (j !== i && list[j]) {
        e.preventDefault()
        selectItem(list[j].id)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lightbox, mode, setMode, room])

  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files')
  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDropping((n) => n + 1)
    },
    onDragOver: (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    },
    onDragLeave: (e: DragEvent) => {
      if (hasFiles(e)) setDropping((n) => Math.max(0, n - 1))
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDropping(0)
      void addFiles([...e.dataTransfer.files]).then((r) => {
        if (r.skipped) {
          toast(t('Up to {{count}} pictures', { count: MAX_IMAGES }))
        }
        if (r.failed) {
          toast.error(t('Could not read this picture; copy or choose it again'))
        }
        ctx.focusComposer()
      })
    },
  }

  let body
  if (load === 'loading' || env.loading) {
    body = <LoadingState className='m-auto' />
  } else if (!env.models.length) {
    body = (
      <EmptyState
        className='m-auto'
        icon={ImageOff}
        title={t('Drawing is not available for your group yet')}
        description={t(
          'Ask the administrator to enable an image model for your group.'
        )}
      />
    )
  } else if (room.fresh) {
    body = <StartPage room={room} />
  } else {
    const canvasShown = narrow ? showCanvas : !canvasOff
    body = (
      <>
        <ChatPane room={room} />
        {!narrow && !canvasOff && (
          <Divider
            rootRef={rootRef}
            onResize={setChatW}
            onDone={() =>
              writeLocal(STORAGE_KEYS.chatWidth, String(Math.round(chatW)))
            }
          />
        )}
        {canvasShown && (
          <CanvasPane room={room} onClose={() => setShowCanvas(false)} />
        )}
      </>
    )
  }

  return (
    <DrawContext.Provider value={ctx}>
      <div
        ref={rootRef}
        className={cn(
          'dw',
          narrow && 'dw-narrow',
          canvasOff && 'dw-cv-off',
          showCanvas && 'dw-show-cv',
          room.fresh && 'dw-start'
        )}
        style={{ '--chat-w': `${chatW}px` } as CSSProperties}
        {...dropProps}
      >
        {body}
        {load === 'unavailable' && (
          <p className='dw-storage-note'>
            {t(
              'This browser can’t keep pictures; they last until you close the page.'
            )}
          </p>
        )}
        <div
          className={cn('dw-drop', dropping > 0 && 'dw-on')}
          aria-hidden='true'
        >
          <div>
            <Images />
            <b>{t('Drop to add')}</b>
            <small>
              {t('Up to {{count}} pictures', { count: MAX_IMAGES })}
            </small>
          </div>
        </div>
        <WarpFilter />
      </div>
      <Lightbox
        room={room}
        target={lightbox}
        onClose={() => setLightbox(null)}
      />
    </DrawContext.Provider>
  )
}
