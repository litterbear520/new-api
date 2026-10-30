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
import type { TFunction } from 'i18next'
import {
  ChevronRight,
  CornerDownRight,
  Pencil,
  RotateCcw,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import {
  MARK_NUMBERS,
  MAX_PENDING,
  MAX_SPLIT,
  getEditLines,
  getNewLines,
  getTips,
} from '../constants'
import { useMoney } from '../hooks/use-money'
import { useNow } from '../hooks/use-now'
import {
  type SendResult,
  applySuggestion,
  confirmPlan,
  drawPlanAsOne,
  fixItem,
  replan,
  retryItem,
} from '../lib/actions'
import { partLabel } from '../lib/prompt'
import type {
  DrawErrorKind,
  DrawItem,
  DrawModelOption,
  DrawResultMessage,
  DrawRoom,
} from '../types'
import { Bear } from './bear'
import { BellPopover } from './bell-popover'
import { useDrawPage } from './draw-context'
import { Elapsed } from './scene'
import { Tip } from './tip'

const LINE_SECS = 8

/** One line every 8 s: a playful line, then a tip, then the next playful line… */
function RunLine(props: { item: DrawItem }) {
  const { t } = useTranslation()
  const now = useNow(true, 1000)
  const k = Math.floor((now - props.item.start) / 1000 / LINE_SECS)
  const half = k >> 1
  const seed = props.item.id.length + props.item.start
  if (k % 2) {
    const tips = getTips(t)
    return (
      <span key={k}>
        <span className='dw-tipk'>{t('Little tip')}</span>
        {tips[(half + seed) % tips.length]}
      </span>
    )
  }
  const edit = props.item.req.imgs.some((img) => img.kind === 'base')
  const lines = edit ? getEditLines(t) : getNewLines(t)
  return (
    <span key={k} className={k === 0 ? 'dw-still' : undefined}>
      {lines[half % lines.length]}
    </span>
  )
}

/** Claude Design style: what is happening, with a playful line or a tip underneath. */
export function RunStatus(props: {
  pending: DrawItem[]
  models: DrawModelOption[]
}) {
  const { t } = useTranslation()
  const it = props.pending[0]
  const name =
    props.models.find((m) => m.id === it.req.model)?.name ?? it.req.model
  const edit = it.req.imgs.some((img) => img.kind === 'base')
  const n = props.pending.length
  let text = edit
    ? t('Editing with {{model}}', { model: name })
    : t('Drawing with {{model}}', { model: name })
  if (n > 1) {
    text = edit
      ? t('Editing {{count}} with {{model}}', { model: name, count: n })
      : t('Drawing {{count}} with {{model}}', { model: name, count: n })
  }
  return (
    <div className='dw-r-run' role='status'>
      <div className='dw-run1'>
        <Bear mode='hop' className='dw-kb-st' />
        <b className='dw-shim'>{text}</b>
        <Elapsed item={it} className='dw-t' />
        <BellPopover variant='icon' />
      </div>
      <div className='dw-run2' aria-live='off'>
        <RunLine item={it} />
      </div>
    </div>
  )
}

function errorCopy(kind: DrawErrorKind, t: TFunction) {
  switch (kind) {
    case 'moderation':
      return {
        title: t('This description did not pass content review'),
        body: t('Try wording it differently. You were not charged.'),
        action: 'fix' as const,
      }
    case 'balance':
      return {
        title: t('Not enough balance for this picture'),
        body: t('Top up and try again. You were not charged.'),
        action: 'topup' as const,
      }
    case 'auth':
      return {
        title: t('The drawing token is unavailable'),
        body: t(
          'It may have been disabled or deleted, or its limit is used up; check “网页画图” on the API keys page. You were not charged.'
        ),
        action: 'retry' as const,
      }
    case 'unreadable':
      return {
        title: t('A picture you attached can no longer be read'),
        body: t('Paste or upload it again, then send. You were not charged.'),
        action: 'fix' as const,
      }
    case 'lost':
      return {
        title: t('The page closed before this picture finished'),
        body: t('It could not be kept, and it may have been charged.'),
        action: 'retry' as const,
      }
    case 'busy':
      return {
        title: t('The server is busy; this picture was not drawn'),
        body: t('You were not charged. You can retry right away.'),
        action: 'retry' as const,
      }
    default:
      return {
        title: t('This picture was not drawn'),
        body: t('You were not charged. You can retry.'),
        action: 'retry' as const,
      }
  }
}

export function ErrorCard(props: {
  room: DrawRoom
  item: DrawItem
  variant: 'chat' | 'canvas'
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ctx = useDrawPage()
  const kind = props.item.error?.kind ?? 'other'
  const copy = errorCopy(kind, t)
  const detail = kind === 'other' ? props.item.error?.message : undefined

  const run = () => {
    if (copy.action === 'topup') {
      void navigate({ to: '/wallet' })
      return
    }
    if (copy.action === 'fix') {
      fixItem(props.room, props.item)
      ctx.focusComposer()
      return
    }
    if (!retryItem(props.room, props.item)) {
      toast(
        t('Up to {{count}} pictures at once; try again when one finishes', {
          count: MAX_PENDING,
        })
      )
    }
  }
  let label = t('Retry')
  let Icon = RotateCcw
  if (copy.action === 'fix') {
    label = t('Edit description')
    Icon = Pencil
  } else if (copy.action === 'topup') {
    label = t('Top up')
    Icon = Wallet
  } else if (kind === 'lost') label = t('Draw again')

  return (
    <div
      className={props.variant === 'chat' ? 'dw-r-err' : 'dw-cv-err'}
      role='alert'
    >
      <b>{copy.title}</b>
      <span>{copy.body}</span>
      {detail && <small className='dw-err-detail'>{detail}</small>}
      <Button size='sm' variant='outline' onClick={run}>
        <Icon />
        {label}
      </Button>
    </div>
  )
}

/** "gpt-image-2 · 31 秒 · $0.034", with the bear cheering once on the newest. */
export function ResultMeta(props: {
  items: DrawItem[]
  last: DrawItem
  isLast: boolean
  /** A split request shows what all its pictures cost together. */
  total?: boolean
}) {
  const { t } = useTranslation()
  const money = useMoney()
  const it = props.last
  const cheerLeft = it.rv ? 1400 - (Date.now() - it.rv) : 0
  const count = props.items.filter((i) => i.img).length
  const cost = props.total
    ? props.items.reduce((sum, i) => sum + (i.cost ?? 0), 0)
    : it.cost
  return (
    <div className='dw-r-meta'>
      {props.isLast && (
        <Bear
          mode={cheerLeft > 0 ? 'cheer' : 'still'}
          cheerAt={(1400 - Math.max(cheerLeft, 0)) / 1000}
          className='dw-kb-st'
        />
      )}
      <span>{it.req.model}</span>
      {it.secs != null && (
        <span className='tabular-nums'>
          {t('{{count}} s', { count: it.secs })}
        </span>
      )}
      {cost != null && <span className='tabular-nums'>{money.cost(cost)}</span>}
      {props.items.length > 1 && (
        <span>{t('{{count}} pictures', { count })}</span>
      )}
    </div>
  )
}

/** "↳ 接着改": fills the composer, never sends. */
export function Suggestions(props: { room: DrawRoom; item: DrawItem }) {
  const { t } = useTranslation()
  const ctx = useDrawPage()
  if (!props.item.sugs?.length) return null
  return (
    <div
      className='dw-sugs'
      role='group'
      aria-label={t('Suggestions for the next change')}
    >
      {/* Pictures drawn before 2026-10-20 kept four. */}
      {props.item.sugs.slice(0, 3).map((text) => (
        <Tip key={text} label={t('Fills the box; nothing is sent yet')}>
          <button
            type='button'
            className='dw-sug'
            onClick={() => {
              applySuggestion(props.room, props.item, text)
              ctx.focusComposer()
            }}
          >
            <CornerDownRight aria-hidden='true' />
            <span>{text}</span>
          </button>
        </Tip>
      ))}
    </div>
  )
}

/** While the planner decides how many pictures the message asks for. */
export function PlanStatus() {
  const { t } = useTranslation()
  return (
    <div className='dw-r-run' role='status'>
      <div className='dw-run1'>
        <Bear mode='hop' className='dw-kb-st' />
        <b className='dw-shim'>{t('Working out how many pictures to draw')}</b>
      </div>
    </div>
  )
}

/** "拆成 2 张：① 红格纹款 ② 蓝纯色款" above the pictures of a split request. */
export function PlanLegend(props: { msg: DrawResultMessage }) {
  const { t } = useTranslation()
  const plan = props.msg.plan
  if (!plan || plan.status !== 'drawn' || plan.parts.length < 2) return null
  return (
    <div className='dw-r-plan'>
      <span>
        {t('Split into {{count}} pictures', { count: plan.parts.length })}
      </span>
      {plan.parts.map((part, i) => (
        <span key={part.text} className='dw-r-plan-p'>
          {partLabel({ i: i + 1, title: part.title })}
        </span>
      ))}
      {plan.capped && (
        <small>
          {t('Up to {{count}} pictures per message; send the rest again', {
            count: MAX_SPLIT,
          })}
        </small>
      )}
    </div>
  )
}

function useSendToast() {
  const { t } = useTranslation()
  return (result: SendResult) => {
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
  }
}

let partSeq = 0

/** Three or more pictures: the plan waits until the user starts it. */
export function PlanCard(props: { room: DrawRoom; msg: DrawResultMessage }) {
  const { t } = useTranslation()
  const ctx = useDrawPage()
  const money = useMoney()
  const sendToast = useSendToast()
  const plan = props.msg.plan
  const [parts, setParts] = useState(() =>
    (plan?.parts ?? []).map((p) => ({ ...p, key: ++partSeq }))
  )
  if (!plan) return null
  const total = (props.msg.est ?? 0) * parts.length
  const start = () =>
    sendToast(confirmPlan(props.room, props.msg, parts, ctx.balanceUsd))

  return (
    <div className='dw-plan' role='group' aria-label={t('Picture plan')}>
      <b>
        {t('This makes {{count}} separate pictures', { count: parts.length })}
      </b>
      <span className='dw-plan-sub'>
        {t(
          'Each picture is charged on its own. Remove or reword any of them first.'
        )}
      </span>
      {plan.capped && (
        <span className='dw-plan-sub'>
          {t('Up to {{count}} pictures per message; send the rest again', {
            count: MAX_SPLIT,
          })}
        </span>
      )}
      <ol className='dw-plan-list'>
        {parts.map((part, i) => (
          <li key={part.key}>
            <span className='dw-plan-n' aria-hidden='true'>
              {MARK_NUMBERS[i]}
            </span>
            <div className='dw-plan-body'>
              {part.title && <b>{part.title}</b>}
              <textarea
                value={part.text}
                rows={2}
                aria-label={t('Description of picture {{n}}', { n: i + 1 })}
                onChange={(e) =>
                  setParts((list) =>
                    list.map((p) =>
                      p.key === part.key ? { ...p, text: e.target.value } : p
                    )
                  )
                }
              />
            </div>
            <Tip label={t('Remove this picture')}>
              <Button
                variant='ghost'
                size='icon'
                aria-label={t('Remove this picture')}
                disabled={parts.length <= 1}
                onClick={() =>
                  setParts((list) => list.filter((p) => p.key !== part.key))
                }
              >
                <X />
              </Button>
            </Tip>
          </li>
        ))}
      </ol>
      <div className='dw-plan-acts'>
        <Button size='sm' onClick={start}>
          {t('Draw {{count}} pictures', { count: parts.length })}
          {total > 0 && (
            <span className='tabular-nums'>≈ {money.cost(total)}</span>
          )}
        </Button>
        <Button
          size='sm'
          variant='ghost'
          onClick={() =>
            sendToast(drawPlanAsOne(props.room, props.msg, ctx.balanceUsd))
          }
        >
          {t('Draw one picture as written')}
        </Button>
      </div>
    </div>
  )
}

/** The page closed while planning; nothing was drawn or charged. */
export function StalePlan(props: { room: DrawRoom; msg: DrawResultMessage }) {
  const { t } = useTranslation()
  const ctx = useDrawPage()
  return (
    <div className='dw-r-err' role='alert'>
      <b>{t('The page closed before drawing started')}</b>
      <span>{t('Nothing was drawn and you were not charged.')}</span>
      <Button
        size='sm'
        variant='outline'
        onClick={() => replan(props.room, props.msg, ctx.balanceUsd)}
      >
        <RotateCcw />
        {t('Start again')}
      </Button>
    </div>
  )
}

/** Folded: the description this picture was drawn from, then the model's own words. */
export function PictureDescription(props: { item: DrawItem }) {
  const { t } = useTranslation()
  const it = props.item
  if (!it.img) return null
  return (
    <details className='dw-desc'>
      <summary>
        <ChevronRight aria-hidden='true' />
        {it.part
          ? t('Description used for {{label}}', { label: partLabel(it.part) })
          : t('Description used')}
      </summary>
      <p>{it.req.text}</p>
      {it.revised && (
        <details className='dw-desc-in'>
          <summary>
            <ChevronRight aria-hidden='true' />
            {t('What the model actually received')}
          </summary>
          <p>{it.revised}</p>
        </details>
      )}
    </details>
  )
}
