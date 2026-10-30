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

import { BearDirector } from '@/features/bear-chat/lib/bear/director'
import type { BearMood } from '@/features/bear-chat/types'
import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import type { AgentMessage } from '../../types'
import { PHASE_ACT, endOf, type Phase } from './bear-work'
import { playEntrance } from './entrance'
import { useBearMood } from './mood'

export type DrawBearState = {
  director: BearDirector | null
  /** What the agent is doing, while it works or waits for the user. */
  phase: Phase | null
  /** When this run started, for the seconds next to the bear. */
  since: number
  /** Start of the current phase (for 「还在想」). */
  phaseSince: number
  /** Set for a moment after the user stopped a run. */
  stopped: boolean
  dark: boolean
  mood: BearMood
  perchRef: RefObject<HTMLDivElement | null>
  onSvg: (svg: SVGSVGElement | null) => void
}

/** The project's latest agent message (the current or the last run). */
export function lastAgent(projectId: string | undefined): AgentMessage | null {
  const messages = findProject(projectId)?.messages ?? []
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'agent') return m
  }
  return null
}

/**
 * Runs the bear on the composer: makes its director once the <svg> is in the
 * page, plays the entrance, acts out the project's live work and reacts when
 * the run ends (a cheer, a startle, or the error shake).
 */
export function useDrawBear(opts: {
  projectId?: string
  dark: boolean
}): DrawBearState {
  const projectId = opts.projectId
  const [svg, setSvg] = useState<SVGSVGElement | null>(null)
  const [director, setDirector] = useState<BearDirector | null>(null)
  const [stopped, setStopped] = useState(false)
  const perchRef = useRef<HTMLDivElement>(null)
  const mood = useBearMood()
  const live = useBearDrawStore((s) => (projectId ? s.live[projectId] : null))
  const phase = live?.phase ?? null
  // the engine keeps one clock per stretch of work (time on a card excluded)
  const since = live ? live.since : 0
  const phaseSince = live ? (live.phaseSince ?? live.since) : 0
  const start = useRef({ dark: opts.dark, mood, busy: phase !== null })
  start.current = { dark: opts.dark, mood, busy: phase !== null }
  const prevPhase = useRef<{
    projectId?: string
    phase: Phase | null
  } | null>(null)

  useEffect(() => {
    if (!svg) return
    const at = start.current
    const d = new BearDirector(svg, { dark: at.dark, mood: at.mood })
    setDirector(d)
    const cut =
      at.mood === 'live' && !at.busy
        ? playEntrance(svg, perchRef.current, d, at.dark)
        : () => undefined
    return () => {
      cut()
      d.dispose()
      setDirector(null)
    }
  }, [svg])

  useEffect(() => {
    director?.setDark(opts.dark)
  }, [director, opts.dark])

  useEffect(() => {
    director?.setMood(mood)
  }, [director, mood])

  useEffect(() => {
    if (!director) return
    const was = prevPhase.current
    prevPhase.current = { projectId, phase }
    if (phase) {
      director.setWork(PHASE_ACT[phase], since)
      return
    }
    if (!was?.phase) return
    if (was.projectId !== projectId) {
      // another project opened in this composer: no verdict on the old run
      director.setWork(null)
      director.finish('done', { waitedMs: 0 })
      return
    }
    const msg = lastAgent(projectId)
    const end = endOf(msg?.status)
    const waitedMs = msg ? (msg.endedAt ?? Date.now()) - msg.startedAt : 0
    director.setWork(null)
    director.finish(end ?? 'done', { waitedMs: end ? waitedMs : 0 })
    // 「好，停下了」 for a moment; any other end clears an old one
    setStopped(end === 'stopped')
    if (end !== 'stopped') return
    const id = setTimeout(() => setStopped(false), 2200)
    return () => clearTimeout(id)
  }, [director, phase, since, projectId])

  // the long-think swap (headphones after 45 s) is checked twice a second
  useEffect(() => {
    if (!director || !phase) return
    const id = setInterval(() => director.tick(), 500)
    return () => clearInterval(id)
  }, [director, phase])

  return useMemo(
    () => ({
      director,
      phase,
      since,
      phaseSince,
      stopped,
      dark: opts.dark,
      mood,
      perchRef,
      onSvg: setSvg,
    }),
    [director, phase, since, phaseSince, stopped, opts.dark, mood]
  )
}
