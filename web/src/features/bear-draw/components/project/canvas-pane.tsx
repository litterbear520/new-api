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
import { Archive, PanelLeftOpen } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  mountNightSky,
  type NightSky,
} from '@/features/bear-chat/lib/night-sky'
import { Tip } from '@/features/draw/components/tip'
import { useMoney } from '@/features/draw/hooks/use-money'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import type { MarkInfo } from '../../lib/canvas/types'
import type { Project } from '../../types'
import { CanvasView } from '../canvas/canvas-view'
import { openDialog } from '../dialogs/dialog-bus'
import type { CanvasHandle } from './use-canvas-focus'

/**
 * Night sky behind the canvas under the night sea (the chat page's sky,
 * without the sea), drawn once: a twinkling sky would repaint the whole
 * pane, and the canvas's bars over it, 30 times a second while you work.
 * It is built after the pictures show (building the stars and the Milky
 * Way is the heaviest part of opening a project); the pane's gradient
 * stands in until then.
 */
function CanvasSky() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    let sky: NightSky | null = null
    const build = () => {
      sky = mountNightSky(cv, {
        horizon: () => 1e6,
        lantern: () => null,
        still: true,
      })
    }
    let cancel: () => void
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(build, { timeout: 600 })
      cancel = () => window.cancelIdleCallback(id)
    } else {
      const id = window.setTimeout(build, 200)
      cancel = () => window.clearTimeout(id)
    }
    return () => {
      cancel()
      sky?.dispose()
    }
  }, [])
  return (
    <div className='bd-cvp-sky' aria-hidden='true'>
      <canvas ref={ref} />
    </div>
  )
}

function EmptyCanvas() {
  const { t } = useTranslation()
  return (
    <div className='bd-cvp-empty'>
      <div className='bd-cvp-empty-art' aria-hidden='true'>
        <i />
        <i />
        <i />
      </div>
      <b>{t('Pictures will appear here')}</b>
      <span>
        {t('You can also drag product photos and references straight in')}
      </span>
    </div>
  )
}

/** The last set with a finished picture: what 「导出」 packs. */
function lastFinishedGroup(p: Project): string | null {
  const ready = new Set(
    p.nodes
      .filter((n) => n.status === 'ready' && n.groupId)
      .map((n) => n.groupId)
  )
  for (let i = p.groups.length - 1; i >= 0; i--) {
    if (ready.has(p.groups[i].id)) return p.groups[i].id
  }
  return null
}

/**
 * The canvas side of a project: the canvas itself on the studio floor
 * (light) or under the night sky (the night sea), 「图会出现在这里」 while it is
 * empty, a bar with the cost, the brand kit and 导出, and — while the chat
 * is folded away — 展开对话 with the title. It stays mounted while hidden,
 * so coming back is instant.
 */
export function CanvasPane(props: {
  project: Project
  dark: boolean
  hidden: boolean
  chatHidden: boolean
  canvasRef: (handle: CanvasHandle | null) => void
  onShowChat: () => void
  onEdit: (nodeId: string) => void
  onMarked: (nodeId: string, dataUrl: string, marks?: MarkInfo[]) => void
  onUpload: (files: File[]) => void
  onExport: (groupId: string) => void
  onNothingToExport: () => void
}) {
  const { t } = useTranslation()
  const money = useMoney()
  const kit = useBearDrawStore((s) => s.brandKit)
  const p = props.project
  const exportLast = () => {
    const groupId = lastFinishedGroup(p)
    if (groupId) props.onExport(groupId)
    else props.onNothingToExport()
  }
  return (
    <section className='bd-cvp' aria-label={t('Canvas')} hidden={props.hidden}>
      {props.dark && <CanvasSky />}
      <div className='bd-cvp-root'>
        <CanvasView
          ref={props.canvasRef}
          project={p}
          onEdit={props.onEdit}
          onMarked={props.onMarked}
          onUpload={props.onUpload}
          onExport={props.onExport}
        />
      </div>
      {p.nodes.length === 0 && <EmptyCanvas />}
      {props.chatHidden && (
        <div className='bd-cvp-left'>
          <Tip label={t('Show the chat')} side='bottom'>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className='bd-cvp-btn'
              aria-label={t('Show the chat')}
              onClick={props.onShowChat}
            >
              <PanelLeftOpen aria-hidden='true' />
            </Button>
          </Tip>
          <span className='bd-cvp-title'>
            {p.title || t('Untitled project')}
          </span>
        </div>
      )}
      <div className='bd-cvp-top'>
        {p.cost > 0 && (
          <span className='bd-cvp-cost bd-num'>
            {t('This project {{cost}}', { cost: money.cost(p.cost) })}
          </span>
        )}
        {kit && (
          <Tip label={t('Brand kit')} side='bottom'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='bd-cvp-brand'
              onClick={() => openDialog('brand')}
            >
              <span className='bd-cvp-sw' aria-hidden='true'>
                {kit.colors.slice(0, 3).map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              {kit.name}
            </Button>
          </Tip>
        )}
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='bd-cvp-act'
          onClick={exportLast}
        >
          <Archive aria-hidden='true' />
          {t('Export')}
        </Button>
      </div>
    </section>
  )
}
