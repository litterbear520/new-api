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
import { ArrowUp, ImagePlus, NotebookPen, Plus, X } from 'lucide-react'
import {
  memo,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/features/draw/components/tip'
import { useGlass } from '@/features/draw/hooks/use-glass'
import { cn } from '@/lib/utils'
import { currentConversation, useBearChatStore } from '@/stores/bear-chat-store'

import { getExamples } from '../constants'
import type { ChatEnv } from '../hooks/use-chat-env'
import type { BearDirector } from '../lib/bear/director'
import { MAX_IMAGES, addPictures, isImageFile } from '../lib/images'
import { sendMessage, stopReply } from '../lib/run'
import type { ChatImage } from '../types'
import { GlowBack, GlowFront } from './glow'
import { ModelMenu } from './model-menu'
import { ParamsMenu } from './params-menu'
import { SystemDialog } from './system-dialog'

const MAX_HEIGHT = 384
const ROTATE_MS = 5200

type ComposerProps = {
  env: ChatEnv
  director: BearDirector | null
  dark: boolean
  /** A reply in this conversation is on its way. */
  busy: boolean
  /** It has started writing text (the working light fades). */
  writing: boolean
  empty: boolean
  images: ChatImage[]
  setImages: (next: ChatImage[]) => void
  perch: ReactNode
}

export const Composer = memo(function Composer(props: ComposerProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const [rot, setRot] = useState(0)
  const [systemOpen, setSystemOpen] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const settings = useBearChatStore((s) => s.settings)
  const setSettings = useBearChatStore((s) => s.setSettings)
  const convId = useBearChatStore((s) => s.curId)
  const convSystem = useBearChatStore(
    (s) => currentConversation(s)?.system ?? ''
  )
  const draftSystem = useBearChatStore((s) => s.draftSystem)
  const elsewhere = useBearChatStore(
    (s) => s.live !== null && s.live.convId !== s.curId
  )
  const setDraftSystem = useBearChatStore((s) => s.setDraftSystem)
  const updateConv = useBearChatStore((s) => s.updateConv)
  const system = convId ? convSystem : draftSystem
  const examples = getExamples(t)
  const example = examples[rot % examples.length]
  const glass = useGlass<HTMLFormElement>(
    props.dark
      ? { bezel: 18, depth: 16, frost: 6, tint: [0.3, 0.55], tone: 'sea' }
      : { bezel: 18, depth: 16, frost: 6, tint: [0.42, 0.7] }
  )

  useEffect(() => {
    if (text) return
    const id = setInterval(() => setRot((r) => r + 1), ROTATE_MS)
    return () => clearInterval(id)
  }, [text])

  // grow with the text up to MAX_HEIGHT, then scroll
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`
  }, [text, props.empty])

  const canSend =
    Boolean(settings.model) &&
    !elsewhere &&
    (text.trim().length > 0 || props.images.length > 0)

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (props.busy) {
      stopReply()
      return
    }
    if (!canSend) return
    sendMessage(text.trim(), props.images)
    setText('')
    props.setImages([])
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !text && !e.shiftKey) {
      e.preventDefault()
      setText(example)
      return
    }
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      e.keyCode !== 229
    ) {
      e.preventDefault()
      if (!props.busy) submit()
    }
  }

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files].filter(isImageFile)
    if (!files.length) return
    e.preventDefault()
    void addPictures(files, props.images, props.setImages).then((skipped) => {
      if (skipped) {
        toast(t('Up to {{count}} pictures per message', { count: MAX_IMAGES }))
      }
    })
  }

  let glow = ''
  if (props.busy) glow = props.writing ? 'fade' : 'work'
  else if (focused) glow = 'focus'

  return (
    <div className='bc-cmpw' data-glow={glow}>
      {props.perch}
      <GlowBack />
      <form
        ref={glass}
        className={cn('bc-cmp bc-glass', text && 'bc-has')}
        autoComplete='off'
        onSubmit={submit}
      >
        {(props.images.length > 0 || system) && (
          <div className='bc-attrow'>
            {system && (
              <button
                type='button'
                className='bc-sys-chip'
                onClick={() => setSystemOpen(true)}
                title={system}
              >
                <NotebookPen aria-hidden='true' />
                <span>{t('System prompt')}</span>
                <small>{system}</small>
              </button>
            )}
            {props.images.map((img) => (
              <div key={img.id} className='bc-att'>
                <img src={img.url} alt={img.name ?? t('Picture')} />
                <button
                  type='button'
                  className='bc-att-x'
                  aria-label={t('Remove picture')}
                  onClick={() =>
                    props.setImages(props.images.filter((x) => x.id !== img.id))
                  }
                >
                  <X aria-hidden='true' />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className='bc-taw'>
          {!text && (
            <div className='bc-ph' aria-hidden='true'>
              <span className='bc-ph-ex'>
                {t('Ask anything, e.g. {{example}}', { example })}
              </span>
              <kbd className='bc-tabk'>Tab</kbd>
            </div>
          )}
          <textarea
            ref={taRef}
            className='bc-ta'
            rows={props.empty ? 2 : 1}
            value={text}
            aria-label={t('Message the model')}
            onChange={(e) => {
              setText(e.target.value)
              props.director?.typing()
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onFocus={() => {
              setFocused(true)
              props.director?.focus(() => !taRef.current?.value)
            }}
            onBlur={() => {
              setFocused(false)
              props.director?.blur()
            }}
          />
        </div>
        <div className='bc-tb'>
          <DropdownMenu>
            <Tip label={t('Add')}>
              <DropdownMenuTrigger
                render={
                  <button
                    type='button'
                    className='bc-ib'
                    aria-label={t('Add pictures or a system prompt')}
                  >
                    <Plus aria-hidden='true' />
                  </button>
                }
              />
            </Tip>
            <DropdownMenuContent
              side='top'
              align='start'
              className='bc-menu w-64 p-1.5'
            >
              <DropdownMenuItem
                className='bc-mi'
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus aria-hidden='true' />
                <span className='bc-mi-tx'>
                  <span>{t('Add pictures')}</span>
                  <small>
                    {t(
                      'For models that can see; you can also paste or drop them'
                    )}
                  </small>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='bc-mi'
                onClick={() => setSystemOpen(true)}
              >
                <NotebookPen aria-hidden='true' />
                <span className='bc-mi-tx'>
                  <span>{t('System prompt')}</span>
                  <small>
                    {t('Tell the model who it is and how to answer')}
                  </small>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ParamsMenu />
          <span className='bc-grow' />
          <ModelMenu
            models={props.env.models}
            groups={props.env.groups}
            model={settings.model}
            group={settings.group}
            onModel={(model) => setSettings({ model })}
            onGroup={(group) => setSettings({ group })}
          />
          <Tip
            label={
              elsewhere
                ? t('Another conversation is still replying')
                : undefined
            }
          >
            <button
              type='submit'
              className={cn('bc-send', props.busy && 'bc-stop')}
              disabled={!props.busy && !canSend}
              aria-label={props.busy ? t('Stop') : t('Send')}
            >
              {props.busy ? (
                <i aria-hidden='true' />
              ) : (
                <ArrowUp aria-hidden='true' />
              )}
            </button>
          </Tip>
        </div>
        <input
          ref={fileRef}
          type='file'
          accept='image/*'
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            void addPictures(files, props.images, props.setImages).then(
              (skipped) => {
                if (skipped) {
                  toast(
                    t('Up to {{count}} pictures per message', {
                      count: MAX_IMAGES,
                    })
                  )
                }
              }
            )
          }}
        />
      </form>
      <GlowFront />
      <SystemDialog
        open={systemOpen}
        value={system}
        onOpenChange={setSystemOpen}
        onSave={(next) => {
          if (convId) {
            updateConv(convId, (c) => ({ ...c, system: next || undefined }))
          } else setDraftSystem(next)
        }}
      />
    </div>
  )
})
