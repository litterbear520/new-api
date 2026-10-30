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
import {
  ArrowDown,
  BookOpen,
  PanelRightClose,
  PanelRightOpen,
  SquarePen,
  Wallet,
} from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { heldCostOf, roomItems, useDrawStore } from '@/stores/draw-store'

import { DRAW_GUIDE_URL } from '../constants'
import { useGlass } from '../hooks/use-glass'
import { useMoney } from '../hooks/use-money'
import type { DrawRoom } from '../types'
import { Composer } from './composer'
import { useDrawPage } from './draw-context'
import { ResultMessage, UserMessage } from './messages'
import { RoomSwitcher } from './room-switcher'
import { Tip } from './tip'

const motionOk = () =>
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The shape of the conversation that should keep it scrolled to the newest. */
function roomSignature(room: DrawRoom) {
  const items = roomItems(room)
    .map((it) => `${it.id}:${it.status}:${it.sugs?.length ?? 0}`)
    .join('|')
  // A plan card replacing the "how many pictures" line grows the chat too.
  const plans = room.msgs
    .map((m) => (m.role === 'ai' ? (m.plan?.status ?? '-') : ''))
    .join('')
  return `${items}#${room.msgs.length}#${plans}`
}

function JumpButton(props: {
  show: boolean
  fresh: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const glass = useGlass<HTMLButtonElement>({
    bezel: 17,
    depth: 8,
    frost: 3,
    tint: [0.35, 0.5],
  })
  return (
    <Tip label={t('Back to the newest')}>
      <button
        ref={glass}
        type='button'
        className={cn(
          'dw-jump dw-glass',
          props.show && 'dw-show',
          props.fresh && 'dw-new'
        )}
        aria-label={t('Back to the newest')}
        onClick={props.onClick}
      >
        <ArrowDown />
        <span className='dw-dot' />
      </button>
    </Tip>
  )
}

export function ChatPane(props: { room: DrawRoom }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ctx = useDrawPage()
  const money = useMoney()
  const goNew = useDrawStore((s) => s.goNew)
  const held = useDrawStore((s) => heldCostOf(s.rooms))
  const scrollRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const [dockH, setDockH] = useState(170)
  const [farFromEnd, setFarFromEnd] = useState(false)
  const [unseen, setUnseen] = useState(false)
  const room = props.room
  const lastAi = [...room.msgs].reverse().find((m) => m.role === 'ai')
  const signature = roomSignature(room)
  const atBottom = useRef(true)

  const toEnd = (smooth: boolean) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth && motionOk() ? 'smooth' : 'auto',
    })
  }

  // A different conversation opens at its newest message.
  useLayoutEffect(() => {
    toEnd(false)
    setUnseen(false)
  }, [room.id])

  // Something new in this conversation: follow it if we were at the end.
  useEffect(() => {
    if (atBottom.current) requestAnimationFrame(() => toEnd(true))
    else setUnseen(true)
  }, [signature])

  useEffect(() => {
    const dock = dockRef.current
    if (!dock) return
    const ro = new ResizeObserver(() => {
      setDockH(dock.offsetHeight)
      if (atBottom.current) toEnd(false)
    })
    ro.observe(dock)
    return () => ro.disconnect()
  }, [])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const d = el.scrollHeight - el.scrollTop - el.clientHeight
    atBottom.current = d < 90
    setFarFromEnd(d > 200)
    if (d < 40) setUnseen(false)
  }

  const balance = ctx.balanceUsd
  const low = balance != null && balance - held < 1
  const canvasTip = ctx.canvasOff ? t('Show the canvas') : t('Fold the canvas')

  return (
    <section
      className='dw-chatp'
      aria-label={t('Conversation')}
      style={{ '--dock-h': `${dockH}px` } as CSSProperties}
    >
      <div ref={scrollRef} className='dw-cp-scroll' onScroll={onScroll}>
        <div className='dw-msgs'>
          {room.msgs.map((m) =>
            m.role === 'user' ? (
              <UserMessage key={m.id} msg={m} />
            ) : (
              <ResultMessage
                key={m.id}
                room={room}
                msg={m}
                isLast={m === lastAi}
              />
            )
          )}
        </div>
      </div>
      <div className='dw-cp-head'>
        <RoomSwitcher room={room} />
        <span className='dw-sp' />
        {balance != null && (
          <Tip label={t('Balance; opens the wallet')}>
            <button
              type='button'
              className={cn('dw-bal tabular-nums', low && 'dw-low')}
              onClick={() => void navigate({ to: '/wallet' })}
            >
              <Wallet aria-hidden='true' />
              <span>{money.balance(balance)}</span>
            </button>
          </Tip>
        )}
        <Tip label={t('Usage guide')}>
          <Button
            variant='ghost'
            size='icon'
            aria-label={t('Usage guide')}
            render={
              <a href={DRAW_GUIDE_URL} target='_blank' rel='noreferrer' />
            }
          >
            <BookOpen />
          </Button>
        </Tip>
        {!ctx.narrow && (
          <Tip label={canvasTip}>
            <Button
              variant='ghost'
              size='icon'
              aria-pressed={!ctx.canvasOff}
              aria-label={canvasTip}
              onClick={() => ctx.setCanvasOn(ctx.canvasOff)}
            >
              {ctx.canvasOff ? <PanelRightOpen /> : <PanelRightClose />}
            </Button>
          </Tip>
        )}
        <Tip label={t('New conversation')}>
          <Button
            variant='ghost'
            size='icon'
            aria-label={t('New conversation')}
            onClick={() => goNew()}
          >
            <SquarePen />
          </Button>
        </Tip>
      </div>
      <div className='dw-edge-b' aria-hidden='true' />
      <div ref={dockRef} className='dw-dock'>
        <JumpButton
          show={farFromEnd}
          fresh={unseen}
          onClick={() => toEnd(true)}
        />
        <Composer room={room} />
        <p className='dw-foot'>
          {t(
            'You can visit other pages while it draws, but don’t close or reload the tab, or the picture is lost and still charged.'
          )}
        </p>
      </div>
    </section>
  )
}
