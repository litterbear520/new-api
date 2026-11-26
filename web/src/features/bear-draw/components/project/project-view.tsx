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
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useSplitSiteBar } from '@/components/site-bar/store'
import { useTheme } from '@/context/theme-provider'
import { cn } from '@/lib/utils'
import { useBearDrawStore } from '@/stores/bear-draw-store'
import { useNightSeaStore } from '@/stores/night-sea-store'

import { NARROW_CARD } from '../../constants'
import { useBearDrawEnv } from '../../hooks/use-env'
import { isBusy, send, stop } from '../../lib/engine'
import type { Project, ProjectLayout } from '../../types'
import { Composer, type ComposerHandle } from '../composer/composer'
import { loadCanvasPane, warmCanvas } from '../lazy-views'
import { PartActionsContext } from '../parts/part-actions'
import { ChatGrip } from './chat-grip'
import { ChatHeader } from './chat-header'
import { readChatWidth, saveChatWidth } from './chat-width'
import { Messages } from './messages'
import { useCanvasFocus } from './use-canvas-focus'
import { useFirstSend } from './use-first-send'
import { useProjectActions } from './use-project-actions'
import { useElementWidth, useProjectHost } from './use-project-host'
import { useProjectNav } from './use-project-nav'
import { useSidebarRail } from './use-sidebar-rail'

// only the project page needs these: they load with its chunk
import '../../css/project.css'
import '../../css/chat.css'
import '../../css/halftone.css'

const CanvasPane = lazy(() =>
  loadCanvasPane().then((m) => ({ default: m.CanvasPane }))
)

/** Loads the canvas code once the page is idle, before anyone asks for it. */
function useWarmCanvas() {
  useEffect(() => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warmCanvas, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(warmCanvas, 1200)
    return () => window.clearTimeout(id)
  }, [])
}

/** True from the first time `on` is true (the canvas stays mounted once shown). */
function useOnce(on: boolean): boolean {
  const [seen, setSeen] = useState(on)
  if (on && !seen) setSeen(true)
  return on || seen
}

function ProjectScreen(props: { project: Project }) {
  const { t } = useTranslation()
  const p = props.project
  const pid = p.id
  const dark = useTheme().resolvedTheme === 'dark'
  // the night sea is found by wishing on a meteor on the home page
  const night = useNightSeaStore((s) => s.on) && dark
  const env = useBearDrawEnv()
  const nav = useProjectNav()
  const busy = useBearDrawStore(() => isBusy(pid))
  const composerRef = useRef<ComposerHandle | null>(null)
  const slotRef = useRef<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [chatW, setChatW] = useState(readChatWidth)
  const { host, ready } = useProjectHost(slotRef)
  const cardW = useElementWidth(host)
  const narrow = cardW > 0 && cardW < NARROW_CARD
  // Narrow cards have no room for both: the canvas comes as a sheet over
  // the chat when asked for, and that is not remembered.
  const [sheet, setSheet] = useState(false)
  // a sheet opened on a narrow card doesn't come back after a wide spell
  if (sheet && cardW > 0 && !narrow) setSheet(false)
  const sheetLayout: ProjectLayout = sheet ? 'canvas' : 'chat'
  // The canvas stays closed until the user opens it (the 画布 button, a
  // picture in the chat); the project remembers what they chose.
  const layout = narrow ? sheetLayout : (p.layout ?? 'chat')
  const canvasOn = layout !== 'chat'
  // measured first: a narrow card must not flash the canvas
  const mounted = useOnce(cardW > 0 && canvasOn)
  const canvas = useCanvasFocus()
  useWarmCanvas()
  // measured first, so a narrow card never folds the sidebar for a moment
  useSidebarRail(cardW > 0 && !narrow && canvasOn)

  const act = useProjectActions({
    projectId: pid,
    narrow,
    composerRef,
    focusCanvas: canvas.request,
    canvasOpening: canvas.opening,
    compareOnCanvas: canvas.compare,
    setSheet,
    balanceUsd: env.balanceUsd,
    busy,
    goHome: nav.home,
  })
  useFirstSend(pid, act.focusComposer)

  /** The pressed button left with its side: its counterpart takes the focus. */
  const focusSoon = (selector: string) =>
    requestAnimationFrame(() =>
      rootRef.current
        ?.querySelector<HTMLElement>(selector)
        ?.focus({ preventScroll: true })
    )
  const onLayout = (next: ProjectLayout) => {
    act.setLayout(next)
    if (next === 'canvas' && !narrow) focusSoon('.bd-cvp-left button')
  }

  const view = (
    <PartActionsContext.Provider value={act.parts}>
      <div
        ref={rootRef}
        className={cn(
          'bd bd-proj',
          `is-${layout}`,
          narrow && 'is-narrow',
          night && 'bd-night',
          dragging && 'is-dragging'
        )}
        style={{ '--chat-w': `${chatW}px` } as CSSProperties}
        // A picture dropped beside the box (the chat, the header) goes into
        // the message; without this the browser opens the file and the page
        // is gone. The box and the canvas take their own drops first.
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) e.preventDefault()
        }}
        onDrop={(e) => {
          if (e.defaultPrevented || !e.dataTransfer.types.includes('Files')) {
            return
          }
          e.preventDefault()
          composerRef.current?.addFiles([...e.dataTransfer.files])
        }}
      >
        <section
          className='bd-chatp'
          aria-label={t('Conversation')}
          hidden={layout === 'canvas' && !narrow}
        >
          <ChatHeader
            project={p}
            layout={layout}
            narrow={narrow}
            onLayout={onLayout}
          />
          <Messages project={p} />
          <div className='bd-chatp-dock'>
            <div className='bd-dock-in'>
              <Composer
                ref={composerRef}
                variant='dock'
                projectId={pid}
                busy={busy}
                onSend={(input) => send(pid, input)}
                onStop={() => stop(pid)}
              />
              {busy && (
                <p className='bd-chatp-foot' role='status'>
                  {t(
                    'You can visit other pages while it draws, but do not close or reload this page, or the pictures are lost and still charged.'
                  )}
                </p>
              )}
            </div>
          </div>
        </section>
        {layout === 'split' && (
          <ChatGrip
            width={chatW}
            target={rootRef}
            onDragging={setDragging}
            onChange={(w) => {
              setChatW(w)
              saveChatWidth(w)
            }}
          />
        )}
        {mounted && (
          <Suspense fallback={null}>
            <CanvasPane
              project={p}
              dark={night}
              hidden={!canvasOn}
              chatHidden={layout === 'canvas'}
              canvasRef={canvas.setHandle}
              onShowChat={() => {
                act.setLayout('split')
                focusSoon('.bd-hd-hide')
              }}
              onEdit={act.onEdit}
              onMarked={act.onMarked}
              onUpload={act.onUpload}
              onExport={act.parts.exportGroup}
            />
          </Suspense>
        )}
      </div>
    </PartActionsContext.Provider>
  )

  return (
    <>
      <div ref={slotRef} className='bd-proj-slot' />
      {ready && createPortal(view, host)}
    </>
  )
}

/**
 * A project: the conversation with the agent beside the canvas (Lovart's
 * workspace). The chat can take the whole page (a centred column) or fold
 * away for the canvas; narrow cards show the chat and bring the canvas as a
 * sheet over it.
 */
export function ProjectView(props: { projectId: string }) {
  // the canvas is a work area: its chat scrolling must not move the bar
  useSplitSiteBar()
  const project = useBearDrawStore(
    (s) => s.projects.find((p) => p.id === props.projectId) ?? null
  )
  if (!project) return null
  return <ProjectScreen project={project} />
}
