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
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { useBearChatStore } from '@/stores/bear-chat-store'

import type { BearAct } from '../lib/bear/acts'
import { BearDirector } from '../lib/bear/director'
import { workAct } from '../lib/bear/work'
import { feelOf, wantsSong } from '../lib/feel'
import type { AssistantTurn, BearMood, UserTurn } from '../types'

/** The entrance plays once per page load, not on every visit to the page. */
let entered = false

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export type BearState = {
  director: BearDirector | null
  /** The work act for the status line, while a reply is on its way. */
  work: BearAct | null
  workSince: number
  /** Set for a moment after the user stopped a reply. */
  stopped: boolean
}

function findTurns(convId: string, turnId: string) {
  const conv = useBearChatStore.getState().convs.find((c) => c.id === convId)
  if (!conv) return null
  const at = conv.turns.findIndex((t) => t.id === turnId)
  const turn = conv.turns[at] as AssistantTurn | undefined
  const user = conv.turns
    .slice(0, Math.max(0, at))
    .reverse()
    .find((t): t is UserTurn => t.role === 'user')
  return turn ? { turn, user } : null
}

/**
 * Runs the bear: creates its director once the <svg> is in the page, plays
 * the entrance, and follows the reply that is streaming.
 */
export function useBear(opts: {
  /** The bear's <svg>, once it is in the page. */
  svg: SVGSVGElement | null
  perch: RefObject<HTMLDivElement | null>
  dark: boolean
  mood: BearMood
}): BearState {
  const [director, setDirector] = useState<BearDirector | null>(null)
  const [work, setWork] = useState<BearAct | null>(null)
  const [workSince, setWorkSince] = useState(0)
  const [stopped, setStopped] = useState(false)
  const darkRef = useRef(opts.dark)
  darkRef.current = opts.dark
  const moodRef = useRef(opts.mood)
  moodRef.current = opts.mood
  const { svg, perch } = opts

  useEffect(() => {
    const el = svg
    if (!el) return
    const d = new BearDirector(el, {
      dark: darkRef.current,
      mood: moodRef.current,
    })
    setDirector(d)
    if (
      !entered &&
      moodRef.current === 'live' &&
      !useBearChatStore.getState().live
    ) {
      entered = true
      // light: peek from behind the glass; dark: drop into the boat
      if (reducedMotion()) d.show('greet')
      else if (darkRef.current) d.show('drop')
      else peekaboo(el, perch.current, d)
    }
    return () => {
      d.dispose()
      setDirector(null)
    }
  }, [svg, perch])

  useEffect(() => {
    director?.setDark(opts.dark)
  }, [director, opts.dark])

  useEffect(() => {
    director?.setMood(opts.mood)
  }, [director, opts.mood])

  // follow the streaming reply
  useEffect(() => {
    if (!director) return
    let last: BearAct | null = null
    let liveId: string | null = null
    const follow = () => {
      const { live } = useBearChatStore.getState()
      if (!live) return
      const found = findTurns(live.convId, live.turnId)
      const reply = found?.turn.replies.find((r) => r.id === live.replyId)
      if (!found || !reply) return
      if (liveId !== live.replyId) {
        liveId = live.replyId
        setStopped(false)
        setWorkSince(reply.startedAt)
        const feel =
          live.kind === 'send' && found.user ? feelOf(found.user.text) : null
        if (feel) director.react(feel)
        else if (live.kind === 'retry') director.react('spin')
      }
      const act = workAct(reply, found.user)
      director.setWork(act, reply.startedAt)
      if (act !== last) {
        last = act
        setWork(act)
      }
    }
    follow()
    const unsub = useBearChatStore.subscribe((state, prev) => {
      if (state.live && state.convs !== prev.convs) follow()
      if (state.live && !prev.live) follow()
      if (!state.live && prev.live) {
        const ended = prev.live
        const found = findTurns(ended.convId, ended.turnId)
        const reply = found?.turn.replies.find((r) => r.id === ended.replyId)
        last = null
        liveId = null
        setWork(null)
        if (!reply) {
          director.setWork(null)
          return
        }
        const kind = finishKind(reply.status)
        if (kind === 'stopped') {
          setStopped(true)
          setTimeout(() => setStopped(false), 2200)
        }
        director.finish(kind, {
          waitedMs: (reply.endedAt ?? Date.now()) - reply.startedAt,
          sing: found?.user ? wantsSong(found.user.text) : false,
          feel: Boolean(found?.user && feelOf(found.user.text)),
        })
      }
    })
    const tick = setInterval(() => director.tick(), 500)
    return () => {
      unsub()
      clearInterval(tick)
    }
  }, [director])

  return useMemo(
    () => ({ director, work, workSince, stopped }),
    [director, work, workSince, stopped]
  )
}

function finishKind(status: string): 'done' | 'error' | 'stopped' {
  if (status === 'done') return 'done'
  if (status === 'error') return 'error'
  return 'stopped'
}

/** Light theme entrance: rise from behind the glass, look around, hop onto the rim. */
function peekaboo(
  el: SVGSVGElement,
  perch: HTMLDivElement | null,
  d: BearDirector
) {
  if (!perch || typeof el.animate !== 'function') {
    d.show('greet')
    return
  }
  perch.classList.add('bc-behind')
  el.animate(
    [{ transform: 'translateY(34px)' }, { transform: 'translateY(13px)' }],
    {
      duration: 460,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      fill: 'forwards',
    }
  )
  setTimeout(() => d.show('peek'), 380)
  setTimeout(() => {
    el.getAnimations().forEach((a) => a.cancel())
    const hop = el.animate(
      [
        { transform: 'translateY(13px)' },
        { transform: 'translateY(-16px) scale(.95,1.06)', offset: 0.45 },
        { transform: 'translateY(0) scale(1.12,.88)', offset: 0.78 },
        { transform: 'none' },
      ],
      { duration: 600, easing: 'ease-out' }
    )
    setTimeout(() => perch.classList.remove('bc-behind'), 230)
    hop.addEventListener('finish', () => d.show('idle'))
  }, 1900)
}
