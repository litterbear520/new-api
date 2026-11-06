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
import { useNavigate } from '@tanstack/react-router'
import { ArrowUp, Wallet } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  baseItem,
  pendingItems,
  roomItems,
  selectedItem,
  useDrawStore,
} from '@/stores/draw-store'

import { MAX_IMAGES, MAX_PENDING, getPhrases } from '../constants'
import { useGlass } from '../hooks/use-glass'
import { useHalo } from '../hooks/use-halo'
import { useMoney } from '../hooks/use-money'
import {
  addFiles,
  addReference,
  attachments,
  heldCost,
  sendDraft,
} from '../lib/actions'
import { ensureAudio } from '../lib/alerts'
import { estimateCost } from '../lib/cost'
import { fillableExample, suggestionOptions } from '../lib/prompt'
import type { DrawRatio, DrawRoom } from '../types'
import { ComposerAttachments } from './composer-attachments'
import { HaloGlow, HaloRing } from './composer-halo'
import { ModelMenu, PlusMenu, RatioMenu } from './composer-menus'
import { useDrawPage } from './draw-context'
import { Tip } from './tip'

const RATIOS: DrawRatio[] = ['auto', 'square', 'land', 'port']
const motionOk = () =>
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

function CheckerIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <rect x='3' y='3' width='18' height='18' rx='3' />
      <path d='M3 12h18M12 3v18' />
      <path
        d='M4 4h8v8H4zM12 12h8v8h-8z'
        fill='currentColor'
        fillOpacity='.28'
        stroke='none'
      />
    </svg>
  )
}

/** On the new-conversation page the grey example changes every few seconds. */
function useRotatingIndex(show: boolean, count: number) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!show) return
    const id = setInterval(() => {
      if (!document.hidden) setI((n) => (n + 1) % count)
    }, 3600)
    return () => clearInterval(id)
  }, [show, count])
  return i % count
}

function RotatingPhrase(props: { index: number; phrase: string }) {
  const { t } = useTranslation()
  return (
    <div className='dw-phr' aria-hidden='true'>
      <span className='dw-k'>{t('Try:')}</span>
      <span key={props.index} className='dw-v'>
        {props.phrase}
      </span>
    </div>
  )
}

export function Composer(props: { room: DrawRoom }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ctx = useDrawPage()
  const money = useMoney()
  const room = props.room
  const draft = useDrawStore((s) => s.draft)
  const setDraft = useDrawStore((s) => s.setDraft)
  const updateRoom = useDrawStore((s) => s.updateRoom)
  const pendingCount = useDrawStore((s) => pendingItems(s.rooms).length)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const glass = useGlass<HTMLFormElement>({
    bezel: 24,
    depth: 20,
    frost: 6,
    tint: [0.42, 0.7],
  })

  const items = roomItems(room)
  const busyHere = items.some((it) => it.status === 'pending')
  const halo = useHalo(busyHere, () =>
    items.some((it) => it.rv != null && Date.now() - it.rv < 1500)
  )
  const base = baseItem(room)
  const list = attachments(room, draft.refs)
  const marked = list.some((a) => a.kind === 'mark')
  const full = pendingCount >= MAX_PENDING
  const sel = selectedItem(room)
  const pictures = items.filter((it) => it.img)

  const pricingModel = ctx.pricing?.data.find(
    (m) => m.model_name === room.model
  )
  const est = estimateCost(pricingModel, ctx.groupRatio, {
    ratio: draft.ratio,
    clear: draft.clear,
    images: list.length,
    edit: Boolean(base),
  })
  const ratioPrices = useMemo(() => {
    const out = {} as Record<DrawRatio, string>
    for (const r of RATIOS) {
      const e = estimateCost(pricingModel, ctx.groupRatio, {
        ratio: r,
        clear: false,
        images: 0,
        edit: false,
      })
      out[r] = e ? `≈ ${money.cost(e.out)}` : ''
    }
    return out
  }, [pricingModel, ctx.groupRatio, money])
  const clearEst = estimateCost(pricingModel, ctx.groupRatio, {
    ratio: 'square',
    clear: true,
    images: 0,
    edit: false,
  })
  const clearPrice = clearEst ? money.cost(clearEst.out) : ''
  const samePrice = useMemo(() => {
    const exprs = ctx.models.map(
      (m) =>
        ctx.pricing?.data.find((p) => p.model_name === m.id)?.billing_expr ?? ''
    )
    return exprs.length > 1 && exprs.every((e) => e && e === exprs[0])
  }, [ctx.models, ctx.pricing])

  let placeholder = t('Describe the picture you want')
  if (room.fresh && !list.length) placeholder = ''
  else if (marked) {
    placeholder =
      (room.mark?.strokes.length ?? 1) > 1
        ? t('Say how to change each area, e.g. “① make it red, ② remove it”')
        : t('Say how to change the circled area')
  } else if (list.length > 1) {
    placeholder = t(
      'Say what to change; “image 1”, “image 2” refer to the pictures above'
    )
  } else if (base) {
    placeholder = t(
      'Say how to change this one, e.g. “make the background daytime”'
    )
  } else if (draft.refs.length) placeholder = t('Say how to use this picture')

  const phrases = getPhrases(t)
  const rotating = Boolean(room.fresh) && !draft.text && !list.length
  const phraseIndex = useRotatingIndex(rotating, phrases.length)
  // Tab puts the grey example into the box, ready to edit.
  let example = ''
  if (rotating) example = fillableExample(phrases[phraseIndex])
  else if (!draft.text && /[”」»"]\s*$/.test(placeholder)) {
    example = fillableExample(placeholder)
  }

  // Browsers without field-sizing grow the box here.
  useEffect(() => {
    const el = textRef.current
    if (!el || CSS.supports('field-sizing', 'content')) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.3, 200)}px`
  }, [draft.text, placeholder])

  const focus = () => textRef.current?.focus()

  const insertText = (text: string) => {
    const el = textRef.current
    if (!el) return
    const a = el.selectionStart ?? el.value.length
    const b = el.selectionEnd ?? a
    const next = el.value.slice(0, a) + text + el.value.slice(b)
    setDraft({ text: next })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + text.length, a + text.length)
    })
  }

  const takeFiles = (files: Iterable<File>) => {
    void addFiles(files).then((r) => {
      if (r.skipped) toast(t('Up to {{count}} pictures', { count: MAX_IMAGES }))
      if (r.failed) {
        toast.error(t('Could not read this picture; copy or choose it again'))
      }
    })
  }

  const send = () => {
    ensureAudio()
    const go = () => {
      const result = sendDraft(est?.total ?? 0, ctx.balanceUsd)
      if (result === 'full') {
        toast(
          t('Up to {{count}} pictures at once; send when one finishes', {
            count: MAX_PENDING,
          })
        )
      }
      if (result === 'balance') {
        toast.error(t('Not enough balance for this picture; top up first'))
      }
      if (result === 'sent' && ctx.narrow) ctx.openCanvas()
    }
    const vt = (
      document as Document & {
        startViewTransition?: (cb: () => void) => unknown
      }
    ).startViewTransition
    if (room.fresh && vt && motionOk()) vt.call(document, () => flushSync(go))
    else go()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const typing = e.nativeEvent.isComposing
    if (e.key === 'Tab' && !e.shiftKey && !typing && example && !draft.text) {
      e.preventDefault()
      const opts = suggestionOptions(example)
      setDraft({
        text: example,
        ...(opts.ratio ? { ratio: opts.ratio } : {}),
        ...(opts.clear ? { clear: true } : {}),
      })
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !typing) {
      e.preventDefault()
      send()
    }
  }

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files]
    if (!files.length) return
    e.preventDefault()
    takeFiles(files)
  }

  const balanceLeft =
    ctx.balanceUsd == null ? null : ctx.balanceUsd - heldCost()
  const low = balanceLeft != null && balanceLeft < 1
  const perPicture = est?.out ?? 0.016

  let estText = est ? money.cost(est.total) : ''
  let estTip = ''
  if (full) {
    estText = t('{{count}} drawing', { count: MAX_PENDING })
    estTip = t('Up to {{count}} pictures at once; send when one finishes', {
      count: MAX_PENDING,
    })
  } else if (est) {
    estTip = t('About {{total}}; you pay for the picture actually drawn', {
      total: money.cost(est.total),
    })
    if (est.images) {
      estTip += t(', including {{count}} attached pictures ({{price}})', {
        count: est.images,
        price: money.cost(est.perImage * est.images),
      })
    }
  }
  let sendTip = t('Draw (Enter)')
  if (full) {
    sendTip = t('Up to {{count}} pictures at once; send when one finishes', {
      count: MAX_PENDING,
    })
  } else if (busyHere) {
    sendTip = t('Draw (Enter); runs alongside the one drawing')
  }

  return (
    <>
      {low && (
        <div className='dw-notice'>
          <Wallet aria-hidden='true' />
          <span>
            {t('Balance {{balance}}', {
              balance: money.balance(ctx.balanceUsd ?? 0),
            })}
            {heldCost() > 0 &&
              t(', {{held}} held for pictures drawing', {
                held: money.cost(heldCost()),
              })}
            {t(', enough for about {{count}} more', {
              count: Math.max(0, Math.floor((balanceLeft ?? 0) / perPicture)),
            })}
          </span>
          <Button size='sm' onClick={() => void navigate({ to: '/wallet' })}>
            {t('Top up')}
          </Button>
        </div>
      )}
      <div className='dw-cwrap'>
        <HaloGlow mounted={halo.mounted} on={halo.on} flash={halo.flash} />
        <form
          ref={glass}
          className='dw-composer dw-glass'
          autoComplete='off'
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <HaloRing mounted={halo.mounted} on={halo.on} flash={halo.flash} />
          <ComposerAttachments
            room={room}
            list={list}
            showDrawingNote={
              !room.fresh &&
              sel?.status === 'pending' &&
              draft.text.trim() !== ''
            }
            wide={ctx.canvasOff && !ctx.narrow}
            perImage={est ? money.cost(est.perImage) : ''}
            onInsert={insertText}
            onFocus={focus}
          />
          <div className={cn('dw-ta-wrap', example && 'dw-has-tab')}>
            <Textarea
              ref={textRef}
              rows={1}
              value={draft.text}
              placeholder={placeholder}
              aria-label={t('Describe the picture you want')}
              className='dw-ta'
              onChange={(e) => setDraft({ text: e.target.value })}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
            />
            {rotating && (
              <RotatingPhrase
                index={phraseIndex}
                phrase={phrases[phraseIndex]}
              />
            )}
            {example && (
              <kbd className='dw-tabk' aria-hidden='true'>
                Tab
              </kbd>
            )}
          </div>
          <div className='dw-crow'>
            <PlusMenu
              pictures={pictures}
              onUpload={() => fileRef.current?.click()}
              onPick={(it) => {
                if (!addReference(room, it)) {
                  toast(t('Up to {{count}} pictures', { count: MAX_IMAGES }))
                }
                focus()
              }}
            />
            <RatioMenu
              ratio={draft.ratio}
              prices={ratioPrices}
              clearPrice={clearPrice}
              onChange={(ratio) => {
                setDraft({ ratio })
                focus()
              }}
            />
            <Tip
              label={t('Transparent background, about {{price}} each', {
                price: clearPrice,
              })}
            >
              <button
                type='button'
                className='dw-cb dw-clear'
                aria-pressed={draft.clear}
                aria-label={t('Transparent background')}
                onClick={() => setDraft({ clear: !draft.clear })}
              >
                <CheckerIcon />
                {draft.clear && <span>{t('Transparent')}</span>}
              </button>
            </Tip>
            <span className='dw-sp' />
            <div className='dw-cr'>
              {estText && (
                <Tip label={estTip}>
                  <span className='dw-est tabular-nums' tabIndex={0}>
                    {estText}
                  </span>
                </Tip>
              )}
              <ModelMenu
                models={ctx.models}
                value={room.model}
                samePrice={samePrice}
                onChange={(model) => {
                  updateRoom(room.id, (r) => ({ ...r, model }))
                  focus()
                }}
              />
              <Tip label={sendTip}>
                <button
                  type='submit'
                  className={cn('dw-send', full && 'dw-wait')}
                  aria-label={t('Start drawing')}
                  disabled={!draft.text.trim() || full}
                >
                  <ArrowUp />
                </button>
              </Tip>
            </div>
          </div>
          <input
            ref={fileRef}
            type='file'
            accept='image/png,image/jpeg,image/webp'
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) takeFiles([...e.target.files])
              e.target.value = ''
            }}
          />
        </form>
      </div>
    </>
  )
}
