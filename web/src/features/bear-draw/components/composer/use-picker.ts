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
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import { SKILLS } from '../../data/skills'
import type { Skill } from '../../types'
import {
  findTrigger,
  matchCanvas,
  matchSkills,
  type CanvasPick,
  type Trigger,
} from './trigger'

export type PickItem =
  | { kind: 'skill'; key: string; skill: Skill; mine: boolean }
  | { kind: 'ref'; key: string; pick: CanvasPick }

type State = { trigger: Trigger; active: number }

/**
 * The "/" skill picker and the "@" canvas picker, driven from the textarea:
 * ↑↓ move, Enter or Tab picks, Esc closes (until the caret leaves that word).
 */
export function usePicker(opts: {
  /** "@" works only in a project, where there is a canvas. */
  projectId?: string
  onChoose: (item: PickItem, trigger: Trigger) => void
}) {
  const { t } = useTranslation()
  const mySkills = useBearDrawStore((s) => s.mySkills)
  const [state, setState] = useState<State | null>(null)
  // start of a trigger closed with Esc, so it stays closed while typing on
  const dismissed = useRef<number | null>(null)
  const projectId = opts.projectId
  const trigger = state?.trigger ?? null

  const items = useMemo<PickItem[]>(() => {
    if (!trigger) return []
    if (trigger.kind === 'skill') {
      const mine = new Set(mySkills.map((s) => s.id))
      const all = [...mySkills, ...SKILLS.filter((s) => !mine.has(s.id))]
      return matchSkills(all, trigger.query).map((skill) => ({
        kind: 'skill',
        key: skill.id,
        skill,
        mine: mine.has(skill.id),
      }))
    }
    return matchCanvas(findProject(projectId), trigger.query, (n) =>
      t('Picture {{n}}', { n })
    ).map((pick) => ({ kind: 'ref', key: pick.node.id, pick }))
  }, [trigger, mySkills, projectId, t])

  /** Opens, follows or closes the picker for the text and caret. */
  const evaluate = useCallback(
    (value: string, caret: number) => {
      const next = findTrigger(value, caret)
      if (!next || (next.kind === 'ref' && !projectId)) {
        dismissed.current = null
        setState(null)
        return
      }
      if (dismissed.current === next.start) return
      dismissed.current = null
      setState((cur) => {
        const same =
          cur?.trigger.kind === next.kind &&
          cur.trigger.start === next.start &&
          cur.trigger.query === next.query
        if (same && cur.trigger.end === next.end) return cur
        return { trigger: next, active: same ? cur.active : 0 }
      })
    },
    [projectId]
  )

  const close = useCallback(() => setState(null), [])

  /** Handles the picker's keys; true when the key was used. */
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!state) return false
    const n = items.length
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (n) {
        const step = e.key === 'ArrowDown' ? 1 : -1
        setState({ ...state, active: (state.active + step + n) % n })
      }
      return true
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && n) {
      e.preventDefault()
      choose(items[Math.min(state.active, n - 1)])
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      dismissed.current = state.trigger.start
      setState(null)
      return true
    }
    return false
  }

  const choose = (item: PickItem) => {
    if (!state) return
    dismissed.current = null
    setState(null)
    opts.onChoose(item, state.trigger)
  }

  const hover = (index: number) => {
    if (state && state.active !== index) setState({ ...state, active: index })
  }

  return {
    kind: trigger?.kind ?? null,
    items,
    active: state ? Math.min(state.active, Math.max(0, items.length - 1)) : 0,
    evaluate,
    close,
    onKey,
    choose,
    hover,
  }
}
