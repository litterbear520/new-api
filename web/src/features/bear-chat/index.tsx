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
import { ArrowDown, Images, MessageSquareOff } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useStickToBottom } from 'use-stick-to-bottom'

import { EmptyState } from '@/components/empty-state'
import { LoadingState } from '@/components/loading-state'
import { useTheme } from '@/context/theme-provider'
import { useGlassLight } from '@/features/draw/hooks/use-glass'
import { disposeGlass } from '@/features/draw/lib/glass'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { currentConversation, useBearChatStore } from '@/stores/bear-chat-store'
import { useNightSeaStore } from '@/stores/night-sea-store'

import { ArtifactPanel } from './components/artifact-panel'
import { BearPerch } from './components/bear-perch'
import { BearSvg } from './components/bear-svg'
import { Composer } from './components/composer'
import { EmptyHero } from './components/empty-hero'
import { Meteors } from './components/meteor'
import { NightSkyCanvas } from './components/night-sky'
import { Thread } from './components/thread'
import { Topbar } from './components/topbar'
import { useBear } from './hooks/use-bear'
import { useChatEnv } from './hooks/use-chat-env'
import { useChatPersistence } from './hooks/use-chat-persistence'
import { artifactsOf, conversationArtifacts } from './lib/artifact-index'
import { splitReply, splitThink } from './lib/artifacts'
import { MAX_IMAGES, addPictures } from './lib/images'
import { DAWN_MS, spreadSky, useSighting } from './lib/meteor-sky'
import { NARROW_CARD, panelWidth } from './lib/panel'
import { stopReply } from './lib/run'
import type { ChatImage } from './types'

import './bear.css'
import './bear-chat.css'

const reduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The artifact the streaming reply is writing right now, if any. */
function useWritingArtifact(): string | null {
  return useBearChatStore((s) => {
    const live = s.live
    if (!live) return null
    const conv = s.convs.find((c) => c.id === live.convId)
    const turn = conv?.turns.find((t) => t.id === live.turnId)
    if (!turn || turn.role !== 'assistant') return null
    const reply = turn.replies.find((r) => r.id === live.replyId)
    if (!reply) return null
    const list = artifactsOf(reply)
    const last = list.at(-1)
    if (!last || last.closed) return null
    // the open fence must be the last block, i.e. still being written
    const open = splitReply(splitThink(reply.content).text, reply.id).open
    return open ? last.id : null
  })
}

export function BearChat() {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  // the night sea is a dark theme found by wishing on a meteor (Meteors)
  const nightOn = useNightSeaStore((s) => s.on)
  const night = dark && nightOn
  const user = useAuthStore((s) => s.auth.user)
  const load = useChatPersistence(user?.id)
  const env = useChatEnv()
  const conv = useBearChatStore(currentConversation)
  const live = useBearChatStore((s) => s.live)
  const panel = useBearChatStore((s) => s.panel)
  const panelW = useBearChatStore((s) => s.settings.panelW)
  const mood = useBearChatStore((s) => s.settings.mood)
  const openPanel = useBearChatStore((s) => s.openPanel)
  const closePanel = useBearChatStore((s) => s.closePanel)
  const select = useBearChatStore((s) => s.select)
  const writingId = useWritingArtifact()

  const rootRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const perchRef = useRef<HTMLDivElement>(null)
  const bearRef = useRef<SVGSVGElement | null>(null)
  const [bearEl, setBearEl] = useState<SVGSVGElement | null>(null)
  const [cardW, setCardW] = useState(1200)
  const [dockH, setDockH] = useState(120)
  const [dragging, setDragging] = useState(false)
  const [dropping, setDropping] = useState(0)
  const [images, setImages] = useState<ChatImage[]>([])
  const bear = useBear({ svg: bearEl, perch: perchRef, dark: night, mood })
  const director = bear.director
  useGlassLight(rootRef, '.bc-glass')

  const onSvg = useCallback((svg: SVGSVGElement | null) => {
    bearRef.current = svg
    setBearEl(svg)
  }, [])

  useEffect(() => () => disposeGlass(), [])

  const scene = conv ? 'chat' : 'empty'
  const busyHere = live !== null && live.convId === conv?.id
  const liveReply = useBearChatStore((s) => {
    const l = s.live
    if (!l || l.convId !== s.curId) return null
    const c = s.convs.find((x) => x.id === l.convId)
    const turn = c?.turns.find((x) => x.id === l.turnId)
    return turn?.role === 'assistant'
      ? (turn.replies.find((r) => r.id === l.replyId) ?? null)
      : null
  })
  const writing = Boolean(liveReply?.textAt)
  const artifacts = useMemo(() => conversationArtifacts(conv), [conv])
  const narrow = cardW < NARROW_CARD
  const panelOn = panel.open && artifacts.some((a) => a.id === panel.artId)
  const width = panelOn ? panelWidth(cardW, panelW) : 0

  const shown = load !== 'loading' && env.models.length > 0

  // sizes: the card for the panel, the dock for the chat's bottom padding
  useEffect(() => {
    const root = rootRef.current
    const dock = dockRef.current
    if (!shown || !root || !dock) return
    const ro = new ResizeObserver(() => {
      setCardW(root.clientWidth)
      setDockH(dock.offsetHeight)
    })
    ro.observe(root)
    ro.observe(dock)
    return () => ro.disconnect()
  }, [shown])

  // an artifact starts streaming: open it in the panel, in code view
  useEffect(() => {
    if (!writingId || narrow) return
    const p = useBearChatStore.getState().panel
    if (p.dismissed === writingId || (p.open && p.artId === writingId)) return
    openPanel(writingId, { view: 'code', max: false })
  }, [writingId, narrow, openPanel])

  // Esc stops the reply, unless it is closing a menu or a dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const target = e.target instanceof Element ? e.target : null
      if (
        target?.closest(
          '[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [data-slot=popover-content]'
        )
      ) {
        return
      }
      if (useBearChatStore.getState().live) stopReply()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // empty → chat: the composer glides from the middle to the bottom (light)
  const lastDockTop = useRef<number | null>(null)
  useLayoutEffect(() => {
    const dock = dockRef.current
    if (!dock) return
    if (scene === 'empty') {
      lastDockTop.current = dock.getBoundingClientRect().top
      return
    }
    const before = lastDockTop.current
    lastDockTop.current = null
    if (
      before == null ||
      night ||
      reduced() ||
      typeof dock.animate !== 'function'
    ) {
      return
    }
    const after = dock.getBoundingClientRect().top
    dock.animate(
      [{ transform: `translateY(${before - after}px)` }, { transform: 'none' }],
      { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }
    )
  }, [scene, night])

  // a wish on a meteor: the sky spreads from where it was caught, the
  // composer goes down to the horizon and the bear drops into its boat
  const [dawn, setDawn] = useState(false)
  const wishTop = useRef<number | null>(null)
  const wishAt = useRef<{ x: number; y: number } | null>(null)
  const directorRef = useRef(director)
  directorRef.current = director
  const onWish = useCallback(
    (x: number, y: number) => {
      const first = !useNightSeaStore.getState().found
      wishTop.current = dockRef.current?.getBoundingClientRect().top ?? null
      wishAt.current = { x, y }
      setDawn(true)
      setTheme('dark')
      useNightSeaStore.getState().setOn(true)
      setTimeout(() => setDawn(false), DAWN_MS)
      if (first) {
        setTimeout(
          () =>
            toast(t('You found the night sea. It stays in the theme menu.')),
          DAWN_MS
        )
      }
    },
    [setTheme, t]
  )
  useLayoutEffect(() => {
    const dock = dockRef.current
    const main = mainRef.current
    const before = wishTop.current
    if (!night || before == null || !dock || !main) return
    wishTop.current = null
    const at = wishAt.current
    wishAt.current = null
    // after useBear has put the bear in its night pose
    setTimeout(() => directorRef.current?.show('drop'), 120)
    const sky = main.querySelector<HTMLElement>('.bc-sky')
    if (sky) spreadSky(sky, main, at)
    if (reduced() || typeof dock.animate !== 'function') return
    const after = dock.getBoundingClientRect().top
    dock.animate(
      [{ transform: `translateY(${before - after}px)` }, { transform: 'none' }],
      { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' }
    )
  }, [night])

  const stick = useStickToBottom({ initial: 'instant', resize: 'smooth' })
  const { scrollToBottom } = stick
  useEffect(() => {
    if (conv?.id) void scrollToBottom('instant')
  }, [conv?.id, scrollToBottom])

  const onCopied = useCallback(() => director?.thumbs(), [director])
  const onNew = useCallback(() => select(null), [select])
  // meteors in the sky: the bear has noticed; clicked, it says to wish on one
  const { sighting, hinted, onSighting, onNotice } = useSighting(() =>
    directorRef.current?.show('startled')
  )
  const notice = sighting && dark && !night
  const perch = useMemo(
    () => (
      <BearPerch
        bear={bear}
        perchRef={perchRef}
        onSvg={onSvg}
        notice={notice}
        hint={notice && hinted}
        onNotice={onNotice}
      />
    ),
    [bear, onSvg, notice, hinted, onNotice]
  )
  const panelArtId = panel.artId
  const onTogglePanel = useCallback(() => {
    if (panelOn) {
      closePanel()
      return
    }
    const target = artifacts.some((a) => a.id === panelArtId)
      ? panelArtId
      : artifacts.at(-1)?.id
    if (target) openPanel(target)
  }, [panelOn, artifacts, panelArtId, closePanel, openPanel])

  const horizon = useCallback(() => {
    const main = mainRef.current
    const dock = dockRef.current
    if (!main || !dock) return 0
    return dock.getBoundingClientRect().top - main.getBoundingClientRect().top
  }, [])

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
      void addPictures([...e.dataTransfer.files], images, setImages).then(
        (skipped) => {
          if (skipped) {
            toast(
              t('Up to {{count}} pictures per message', { count: MAX_IMAGES })
            )
          }
        }
      )
    },
  }

  if (load === 'loading' || (env.loading && !env.models.length)) {
    return <LoadingState className='m-auto' />
  }
  if (!env.loading && !env.models.length) {
    return (
      <EmptyState
        className='m-auto'
        icon={MessageSquareOff}
        title={t('No chat model is available for your group yet')}
        description={t(
          'Ask the administrator to enable a chat model for your group.'
        )}
      />
    )
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        'bc',
        night && 'bc-night',
        dawn && 'bc-dawn',
        panelOn && 'bc-art',
        panelOn && panel.max && 'bc-art-max',
        narrow && 'bc-narrow',
        dragging && 'bc-dragging',
        busyHere && 'bc-busy'
      )}
      data-mood={mood}
      style={
        { '--aw': `${width}px`, '--dock-h': `${dockH}px` } as CSSProperties
      }
      {...dropProps}
    >
      <section ref={mainRef} className='bc-main'>
        {night && (
          <NightSkyCanvas
            horizon={horizon}
            bear={bearRef}
            still={reduced()}
            layoutKey={`${scene}:${dockH}:${width}:${cardW}`}
          />
        )}
        {dark && (
          <Meteors active={!night} onSighting={onSighting} onWish={onWish} />
        )}
        <Topbar
          artifacts={artifacts.length}
          panelOpen={panelOn}
          onNew={onNew}
          onTogglePanel={onTogglePanel}
        />
        <div className='bc-pane' data-scene={scene}>
          {scene === 'empty' && <EmptyHero dark={night} />}
          <div ref={stick.scrollRef} className='bc-thread'>
            <div ref={stick.contentRef}>
              {conv && (
                <Thread
                  conv={conv}
                  env={env}
                  liveReplyId={live?.replyId ?? null}
                  busy={live !== null}
                  onCopied={onCopied}
                  onNewConversation={onNew}
                />
              )}
            </div>
          </div>
          <div className='bc-dock'>
            <div ref={dockRef} className='bc-dock-in'>
              <button
                type='button'
                className={cn(
                  'bc-tobot bc-glass',
                  conv && !stick.isNearBottom && 'bc-on'
                )}
                aria-label={t('Jump to the latest')}
                onClick={() => void scrollToBottom('smooth')}
              >
                <BearSvg className='bc-mini' />
                <ArrowDown className='bc-arr' aria-hidden='true' />
              </button>
              <Composer
                env={env}
                director={director}
                dark={night}
                busy={busyHere}
                writing={writing}
                empty={scene === 'empty'}
                images={images}
                setImages={setImages}
                perch={perch}
              />
              <p className='bc-disc'>
                {t(
                  'Models make mistakes too. Double-check anything important.'
                )}
              </p>
            </div>
          </div>
        </div>
        {load === 'unavailable' && (
          <p className='bc-storage-note'>
            {t(
              'This browser cannot keep conversations; they last until you close the page.'
            )}
          </p>
        )}
      </section>
      <ArtifactPanel
        artifacts={artifacts}
        writingId={writingId}
        cardW={cardW}
        narrow={narrow}
        onDragging={setDragging}
      />
      <div
        className={cn('bc-drop', dropping > 0 && 'bc-on')}
        aria-hidden='true'
      >
        <div>
          <Images />
          <b>{t('Drop to add pictures')}</b>
          <small>
            {t('Up to {{count}} pictures per message', { count: MAX_IMAGES })}
          </small>
        </div>
      </div>
    </div>
  )
}
