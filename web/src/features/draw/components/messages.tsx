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
  CircleAlert,
  Copy,
  Download,
  PanelRightOpen,
  RotateCcw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { selectedItem } from '@/stores/draw-store'

import { getRatioOptions } from '../constants'
import { useImageUrl } from '../hooks/use-image-url'
import { useMoney } from '../hooks/use-money'
import { usePictureActions } from '../hooks/use-picture-actions'
import { selectItem } from '../lib/actions'
import { estimateCost } from '../lib/cost'
import { partLabel } from '../lib/prompt'
import { itemAspect } from '../lib/reveal'
import type {
  DrawItem,
  DrawResultMessage,
  DrawRoom,
  DrawUserMessage,
} from '../types'
import { useDrawPage } from './draw-context'
import { ImageMenu } from './image-menu'
import {
  ErrorCard,
  PictureDescription,
  PlanCard,
  PlanLegend,
  PlanStatus,
  ResultMeta,
  RunStatus,
  StalePlan,
  Suggestions,
} from './message-parts'
import { RevealImage } from './reveal-image'
import { Scene } from './scene'
import { Tip } from './tip'

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function AttachedThumb(props: { id: string; label: string }) {
  const { t } = useTranslation()
  const ctx = useDrawPage()
  const url = useImageUrl(props.id, 'thumb')
  return (
    <button
      type='button'
      className='dw-u-th'
      aria-label={t('View the {{kind}} picture', { kind: props.label })}
      onClick={() => ctx.openLightbox({ imageId: props.id })}
    >
      {url ? <img src={url} alt='' /> : <span className='dw-img-wait' />}
      <span>{props.label}</span>
    </button>
  )
}

export function UserMessage(props: { msg: DrawUserMessage }) {
  const { t } = useTranslation()
  const ratios = getRatioOptions(t)
  const kindLabel = {
    base: t('Original'),
    mark: t('Circled'),
    ref: t('Reference'),
  }
  const opts = [
    props.msg.ratio !== 'auto'
      ? ratios.find((r) => r.id === props.msg.ratio)?.name
      : '',
    props.msg.clear ? t('Transparent background') : '',
  ].filter(Boolean)
  return (
    <div className='dw-u'>
      {props.msg.imgs.length > 0 && (
        <div className='dw-u-att'>
          {props.msg.imgs.map((img) => (
            <AttachedThumb
              key={img.id}
              id={img.id}
              label={kindLabel[img.kind]}
            />
          ))}
        </div>
      )}
      <div className='dw-bubble'>{props.msg.text}</div>
      {opts.length > 0 && <div className='dw-u-opt'>{opts.join(t(', '))}</div>}
    </div>
  )
}

type ThumbProps = {
  room: DrawRoom
  item: DrawItem
  on: boolean
  wide: boolean
  height: number
  refPrice: string
}

function ResultThumb(props: ThumbProps) {
  const { t } = useTranslation()
  const ctx = useDrawPage()
  const it = props.item
  const [w, h] = itemAspect(it)
  const ar = w / h
  let ww = 300
  if (ar > 1.2) ww = 400
  else if (ar < 0.8) ww = 220
  const tw = props.wide
    ? ww
    : Math.round(
        clamp(props.height * ar, props.height * 0.62, props.height * 1.75)
      )
  const th = props.wide ? Math.round(ww / ar) : props.height
  const style = { width: tw, height: props.wide ? th : undefined }
  const edit = it.req.imgs.some((img) => img.kind === 'base')
  const verb = edit ? t('Editing') : t('Drawing now')
  const badge = it.part ? (
    <span className='dw-th-n' aria-hidden='true'>
      {partLabel({ i: it.part.i, title: '' })}
    </span>
  ) : null
  const open = () => {
    selectItem(it.id)
    if (props.wide && it.img) ctx.openLightbox({ item: it })
    else ctx.openCanvas()
  }

  if (it.status === 'pending' && props.wide) {
    return (
      <div
        className={cn('dw-th dw-pend', props.on && 'dw-on')}
        style={style}
        role='status'
        aria-label={verb}
      >
        <Scene item={it} size='mid' />
        {badge}
      </div>
    )
  }
  if (it.status === 'pending') {
    return (
      <button
        type='button'
        className={cn('dw-th dw-pend', props.on && 'dw-on')}
        style={style}
        aria-label={t('{{verb}}; show on the canvas', { verb })}
        onClick={open}
      >
        <Scene item={it} size='mini' />
        {badge}
      </button>
    )
  }
  if (it.status === 'error' || !it.img) {
    return (
      <button
        type='button'
        className={cn('dw-th dw-err', props.on && 'dw-on')}
        style={style}
        aria-label={t('This picture was not drawn')}
        onClick={open}
      >
        <CircleAlert aria-hidden='true' />
        {badge}
      </button>
    )
  }
  return (
    <ImageMenu room={props.room} item={it} refPrice={props.refPrice}>
      <button
        type='button'
        className={cn('dw-th', props.on && 'dw-on')}
        style={style}
        aria-label={
          props.wide
            ? t('View this picture large')
            : t('Show this picture on the canvas')
        }
        onClick={open}
      >
        <RevealImage
          item={it}
          revealAt={it.rv}
          size={props.wide ? 'mid' : 'mini'}
          variant='thumb'
          w={tw}
          h={th}
          rim={props.wide}
        />
        {badge}
      </button>
    </ImageMenu>
  )
}

export function ResultMessage(props: {
  room: DrawRoom
  msg: DrawResultMessage
  isLast: boolean
}) {
  const { t } = useTranslation()
  const ctx = useDrawPage()
  const money = useMoney()
  const acts = usePictureActions()
  const sel = selectedItem(props.room)
  const wide = ctx.canvasOff && !ctx.narrow
  const items = props.msg.items
  const pending = items.filter((it) => it.status === 'pending')
  const last = items.at(-1)
  const plan = props.msg.plan
  if (!last) {
    if (!plan) return null
    return (
      <div className={cn('dw-r', props.isLast && 'dw-last')}>
        {plan.status === 'planning' && <PlanStatus />}
        {plan.status === 'confirm' && (
          <PlanCard room={props.room} msg={props.msg} />
        )}
        {plan.status === 'stale' && (
          <StalePlan room={props.room} msg={props.msg} />
        )}
      </div>
    )
  }
  const split = plan?.status === 'drawn'
  const shown =
    items.find((it) => it.id === sel?.id && it.img) ??
    [...items].reverse().find((it) => it.img)
  const pricingModel = ctx.pricing?.data.find(
    (m) => m.model_name === last.req.model
  )
  const perImage = estimateCost(pricingModel, ctx.groupRatio, {
    ratio: 'auto',
    clear: false,
    images: 1,
    edit: false,
  })
  const refPrice = perImage ? money.cost(perImage.perImage) : ''

  let meta = null
  if (pending.length) meta = <RunStatus pending={pending} models={ctx.models} />
  else if (last.status === 'error') {
    meta = <ErrorCard room={props.room} item={last} variant='chat' />
  } else {
    meta = (
      <ResultMeta
        items={items}
        last={last}
        isLast={props.isLast}
        total={split}
      />
    )
  }

  return (
    <div className={cn('dw-r', props.isLast && 'dw-last')}>
      <PlanLegend msg={props.msg} />
      <div className='dw-r-th'>
        {items.map((it) => (
          <ResultThumb
            key={it.id}
            room={props.room}
            item={it}
            on={it.id === sel?.id}
            wide={wide}
            height={ctx.narrow ? 150 : 96}
            refPrice={refPrice}
          />
        ))}
      </div>
      {meta}
      {wide && shown?.img && (
        <div className='dw-r-acts'>
          <Tip label={t('Draw another with the same description')}>
            <Button
              variant='ghost'
              size='icon'
              aria-label={t('Draw another')}
              onClick={() => acts.again(props.room, shown)}
            >
              <RotateCcw />
            </Button>
          </Tip>
          <Tip label={t('Download')}>
            <Button
              variant='ghost'
              size='icon'
              aria-label={t('Download')}
              onClick={() => shown.img && acts.download(shown.img.id)}
            >
              <Download />
            </Button>
          </Tip>
          <Tip label={t('Copy description')}>
            <Button
              variant='ghost'
              size='icon'
              aria-label={t('Copy description')}
              onClick={() => acts.copyPrompt(shown)}
            >
              <Copy />
            </Button>
          </Tip>
          <Tip label={t('Open on the canvas to circle and compare')}>
            <Button
              variant='ghost'
              size='icon'
              aria-label={t('Open on the canvas')}
              onClick={() => {
                selectItem(shown.id)
                ctx.setCanvasOn(true)
              }}
            >
              <PanelRightOpen />
            </Button>
          </Tip>
        </div>
      )}
      {shown && <PictureDescription key={shown.id} item={shown} />}
      {props.isLast && !pending.length && shown && last.status !== 'error' && (
        <Suggestions room={props.room} item={shown} />
      )}
    </div>
  )
}
