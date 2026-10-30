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
  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  Eye,
  Globe,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCw,
  Shapes,
  Smartphone,
  X,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/features/draw/components/tip'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'
import { useBearChatStore, type PanelView } from '@/stores/bear-chat-store'

import { artifactLabel } from '../lib/labels'
import { panelWidth } from '../lib/panel'
import { downloadText } from '../lib/transfer'
import type { Artifact } from '../types'
import { BearSvg } from './bear-svg'
import { CodeView } from './code-view'

function KindIcon(props: { kind: Artifact['kind'] }) {
  if (props.kind === 'html') return <Globe aria-hidden='true' />
  if (props.kind === 'svg') return <Shapes aria-hidden='true' />
  return <Code2 aria-hidden='true' />
}

/** What runs in the preview frame: the page itself, or an SVG centred on a page. */
function previewDoc(a: Artifact): string {
  if (a.kind === 'html') return a.code
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%}body{display:grid;place-items:center;background:#fff}svg{max-width:92vw;max-height:92vh;height:auto}</style>${a.code}`
}

const mimeOf = (a: Artifact) => {
  if (a.kind === 'html') return 'text/html'
  if (a.kind === 'svg') return 'image/svg+xml'
  return 'text/plain'
}

type ArtifactPanelProps = {
  artifacts: Artifact[]
  /** The artifact still being written, if any. */
  writingId: string | null
  /** The card's width, for clamping the drag. */
  cardW: number
  narrow: boolean
  onDragging: (on: boolean) => void
}

export function ArtifactPanel(props: ArtifactPanelProps) {
  const { t } = useTranslation()
  const panel = useBearChatStore((s) => s.panel)
  const panelW = useBearChatStore((s) => s.settings.panelW)
  const setPanel = useBearChatStore((s) => s.setPanel)
  const closePanel = useBearChatStore((s) => s.closePanel)
  const setSettings = useBearChatStore((s) => s.setSettings)
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: false })
  const [reload, setReload] = useState(0)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const art = props.artifacts.find((a) => a.id === panel.artId) ?? null
  const writing = art !== null && art.id === props.writingId
  const previewable = art !== null && art.kind !== 'code'
  const view: PanelView = previewable ? panel.view : 'code'
  const doc = useMemo(
    () => (art && previewable && art.closed ? previewDoc(art) : ''),
    [art, previewable]
  )

  // finished writing: show the result
  const wasWriting = useRef(false)
  useEffect(() => {
    if (wasWriting.current && !writing && previewable) {
      setPanel({ view: 'preview' })
    }
    wasWriting.current = writing
  }, [writing, previewable, setPanel])

  if (!art) return <aside className='bc-ap' aria-hidden='true' />

  const lines = art.code ? art.code.split('\n').length : 0
  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const card = handle.closest('.bc')?.getBoundingClientRect()
    if (!card) return
    props.onDragging(true)
    const move = (ev: PointerEvent) => {
      const w = panelWidth(card.width, Math.round(card.right - ev.clientX))
      setSettings({ panelW: w })
    }
    const up = () => {
      props.onDragging(false)
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }
  const onDragKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const now = panelWidth(props.cardW, panelW)
    setSettings({
      panelW: panelWidth(props.cardW, now + (e.key === 'ArrowLeft' ? 40 : -40)),
    })
  }

  return (
    <aside
      className='bc-ap'
      aria-label={t('Artifact')}
      data-view={view}
      data-device={panel.device}
      data-kind={art.kind}
    >
      {!props.narrow && !panel.max && (
        <div
          className='bc-ap-drag'
          role='separator'
          aria-orientation='vertical'
          aria-label={t('Drag to resize')}
          tabIndex={0}
          onPointerDown={startDrag}
          onDoubleClick={() => setSettings({ panelW: 0 })}
          onKeyDown={onDragKey}
        />
      )}
      <div className='bc-ap-card'>
        <div className='bc-ap-h'>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button type='button' className='bc-ap-file'>
                  <KindIcon kind={art.kind} />
                  <span>{artifactLabel(art, t)}</span>
                  {props.artifacts.length > 1 && (
                    <ChevronDown className='bc-chev' aria-hidden='true' />
                  )}
                </button>
              }
            />
            {props.artifacts.length > 1 && (
              <DropdownMenuContent align='start' className='bc-menu w-72 p-1.5'>
                <DropdownMenuRadioGroup
                  value={art.id}
                  onValueChange={(id) => {
                    const next = props.artifacts.find((a) => a.id === id)
                    if (next) {
                      setPanel({
                        artId: next.id,
                        view: next.kind === 'code' ? 'code' : panel.view,
                      })
                    }
                  }}
                >
                  {props.artifacts.map((a) => (
                    <DropdownMenuRadioItem
                      key={a.id}
                      value={a.id}
                      className='bc-mi'
                    >
                      <KindIcon kind={a.kind} />
                      <span className='bc-mi-tx'>
                        <span>{artifactLabel(a, t)}</span>
                        <small>{a.file}</small>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            )}
          </DropdownMenu>
          {previewable && (
            <div className='bc-seg' role='group' aria-label={t('View')}>
              <button
                type='button'
                aria-pressed={view === 'preview'}
                onClick={() => setPanel({ view: 'preview' })}
              >
                <Eye aria-hidden='true' />
                {t('Preview')}
              </button>
              <button
                type='button'
                aria-pressed={view === 'code'}
                onClick={() => setPanel({ view: 'code' })}
              >
                <Code2 aria-hidden='true' />
                {t('Code')}
              </button>
            </div>
          )}
          <span className='bc-grow' />
          {previewable && view === 'preview' && (
            <>
              <div
                className='bc-seg bc-seg-icons'
                role='group'
                aria-label={t('Preview width')}
              >
                <Tip label={t('Desktop width')}>
                  <button
                    type='button'
                    aria-label={t('Desktop width')}
                    aria-pressed={panel.device === 'desk'}
                    onClick={() => setPanel({ device: 'desk' })}
                  >
                    <Monitor aria-hidden='true' />
                  </button>
                </Tip>
                <Tip label={t('Phone width')}>
                  <button
                    type='button'
                    aria-label={t('Phone width')}
                    aria-pressed={panel.device === 'phone'}
                    onClick={() => setPanel({ device: 'phone' })}
                  >
                    <Smartphone aria-hidden='true' />
                  </button>
                </Tip>
              </div>
              <Tip label={t('Run again')}>
                <button
                  type='button'
                  className='bc-tbtn'
                  aria-label={t('Run again')}
                  onClick={() => setReload((n) => n + 1)}
                >
                  <RotateCw aria-hidden='true' />
                </button>
              </Tip>
            </>
          )}
          <Tip label={copiedText ? t('Copied') : t('Copy code')}>
            <button
              type='button'
              className='bc-tbtn'
              aria-label={t('Copy code')}
              onClick={() => void copyToClipboard(art.code)}
            >
              {copiedText ? (
                <Check aria-hidden='true' />
              ) : (
                <Copy aria-hidden='true' />
              )}
            </button>
          </Tip>
          <Tip label={t('Download')}>
            <button
              type='button'
              className='bc-tbtn'
              aria-label={t('Download')}
              onClick={() => downloadText(art.file, art.code, mimeOf(art))}
            >
              <Download aria-hidden='true' />
            </button>
          </Tip>
          {!props.narrow && (
            <Tip label={panel.max ? t('Exit full screen') : t('Full screen')}>
              <button
                type='button'
                className='bc-tbtn'
                aria-label={
                  panel.max ? t('Exit full screen') : t('Full screen')
                }
                onClick={() => setPanel({ max: !panel.max })}
              >
                {panel.max ? (
                  <Minimize2 aria-hidden='true' />
                ) : (
                  <Maximize2 aria-hidden='true' />
                )}
              </button>
            </Tip>
          )}
          <Tip label={t('Close')}>
            <button
              type='button'
              className='bc-tbtn'
              aria-label={t('Close')}
              onClick={() => closePanel(props.writingId)}
            >
              <X aria-hidden='true' />
            </button>
          </Tip>
        </div>
        <div className='bc-ap-b'>
          {previewable && view === 'preview' && (
            <div className={cn('bc-prev', !doc && 'bc-waiting')}>
              {doc ? (
                <iframe
                  key={`${art.id}:${reload}`}
                  ref={frameRef}
                  title={t('Preview of {{name}}', {
                    name: artifactLabel(art, t),
                  })}
                  sandbox='allow-scripts allow-modals'
                  referrerPolicy='no-referrer'
                  srcDoc={doc}
                />
              ) : (
                <div className='bc-wait'>
                  <BearSvg className='bc-wait-bear' act='web' />
                  <span>{t('It can be previewed once it is written')}</span>
                </div>
              )}
            </div>
          )}
          {view === 'code' && (
            <CodeView code={art.code} lang={art.lang} follow={writing} />
          )}
        </div>
        <div className='bc-ap-f'>
          <span className='tabular-nums'>
            {art.kind === 'code' ? art.lang : art.kind.toUpperCase()} ·{' '}
            {t('{{count}} lines', { count: lines })}
          </span>
          <span className='bc-grow' />
          <span className={cn(writing && 'bc-shim')}>
            {writing && t('Writing {{name}}', { name: art.file })}
            {!writing &&
              previewable &&
              t('Runs in a sandbox, away from your account')}
          </span>
        </div>
      </div>
    </aside>
  )
}
