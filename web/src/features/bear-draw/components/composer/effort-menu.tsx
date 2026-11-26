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
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tip } from '@/features/draw/components/tip'
import { useBearDrawStore } from '@/stores/bear-draw-store'

import { EFFORTS, latestPlanner, PLANNERS, TAKES_EFFORT } from '../../constants'
import { useBearDrawEnv } from '../../hooks/use-env'
import { EffortSlider } from './effort-slider'
import { OPEN_EVENT, type ModelMenuAsk } from './model-menu-bus'

/**
 * Agent mode: one chip that says how hard the bear thinks (Codex's picker).
 * It opens the model in one row (「最新」 until one is picked by hand; the
 * row turns the panel to the list) over the thinking-effort slider. The
 * image model is not offered: the page draws with the recommended one.
 */
export function EffortMenu() {
  const { t } = useTranslation()
  const env = useBearDrawEnv()
  const auto = useBearDrawStore((s) => s.prefs.auto)
  const brain = useBearDrawStore((s) => s.prefs.brain)
  const effort = useBearDrawStore((s) => s.prefs.effort)
  const setPrefs = useBearDrawStore((s) => s.setPrefs)
  const [open, setOpen] = useState(false)
  const [listing, setListing] = useState(false)
  // 「换模型」 on an error card: the pick closes the panel and runs its step
  const [afterPick, setAfterPick] = useState<(() => void) | null>(null)

  useEffect(() => {
    const ask = (e: Event) => {
      const detail = (e as CustomEvent<ModelMenuAsk>).detail ?? {}
      setListing(true)
      setAfterPick(() => detail.onPicked ?? null)
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, ask)
    return () => window.removeEventListener(OPEN_EVENT, ask)
  }, [])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setListing(false)
      setAfterPick(null)
    }
  }

  const can = env.brainModels.map((m) => m.id)
  const ours = PLANNERS.filter((m) => can.includes(m.id))
  // an account without any of ours picks among the chat models it has
  const offered = ours.length ? ours : can.map((id) => ({ id, name: id }))
  // a planner picked earlier that the list no longer offers stays pickable
  const mine =
    !auto && !offered.some((m) => m.id === brain)
      ? [{ id: brain, name: brain }]
      : []
  const rows = [...offered, ...mine]
  const nameOf = (id: string) =>
    [...PLANNERS, ...rows].find((m) => m.id === id)?.name ?? id
  // what a request made now goes to (the engine walks the same order)
  const latest = latestPlanner(can)
  const used = auto ? latest : brain
  const takesEffort = TAKES_EFFORT.test(used)
  const level = t(EFFORTS.find((x) => x.id === effort)?.label ?? 'Medium')
  const model = auto ? t('Latest') : nameOf(brain)

  const pick = (patch: { auto: true } | { brain: string }) => {
    setPrefs(patch)
    const run = afterPick
    if (run) {
      onOpenChange(false)
      run()
    } else {
      setListing(false)
    }
  }

  /** ↑ ↓ walk the rows of the list, as in a group of radios. */
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const all = [...e.currentTarget.querySelectorAll<HTMLElement>('button')]
    const at = all.indexOf(document.activeElement as HTMLElement)
    const step = e.key === 'ArrowDown' ? 1 : -1
    e.preventDefault()
    all[(at + step + all.length) % all.length]?.focus()
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tip label={t('Thinking effort')}>
        <PopoverTrigger
          render={
            <button
              type='button'
              className='bd-chip bd-effort-chip'
              data-level={takesEffort ? effort : undefined}
              data-plain={takesEffort ? undefined : ''}
              aria-label={
                takesEffort
                  ? t('Thinking effort: {{level}}', { level })
                  : t('Model: {{name}}', { name: model })
              }
            >
              {takesEffort ? (
                <>
                  <i>{t('Think')}</i>
                  <b>{level}</b>
                </>
              ) : (
                <b>{model}</b>
              )}
              <ChevronDown className='bd-chev' aria-hidden='true' />
            </button>
          }
        />
      </Tip>
      <PopoverContent
        side='top'
        align='end'
        sideOffset={8}
        className='bd-pop bd-effort w-[min(288px,calc(100vw-24px))]'
        data-plain={takesEffort ? undefined : ''}
      >
        {listing ? (
          <div
            className='bd-effort-list'
            role='radiogroup'
            aria-label={t('Model')}
            onKeyDown={onListKey}
          >
            <button
              type='button'
              className='bd-effort-back'
              onClick={() => setListing(false)}
            >
              <ChevronLeft aria-hidden='true' />
              {t('Model')}
            </button>
            <ModelRow
              name={t('Latest')}
              on={auto}
              onPick={() => pick({ auto: true })}
            />
            {rows.map((m) => (
              <ModelRow
                key={m.id}
                name={m.name}
                on={!auto && brain === m.id}
                onPick={() => pick({ brain: m.id })}
              />
            ))}
          </div>
        ) : (
          <>
            <button
              type='button'
              className='bd-effort-model'
              aria-label={t('Model: {{name}}', { name: model })}
              onClick={() => setListing(true)}
            >
              <i>{t('Model')}</i>
              <b>{model}</b>
              {auto && <span>{nameOf(latest)}</span>}
              <ChevronRight aria-hidden='true' />
            </button>
            {takesEffort && (
              <EffortSlider
                value={effort}
                onChange={(next) => setPrefs({ effort: next })}
              />
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

function ModelRow(props: { name: string; on: boolean; onPick: () => void }) {
  return (
    <button
      type='button'
      role='radio'
      // the list opens on the row that is in use
      autoFocus={props.on}
      aria-checked={props.on}
      className='bd-effort-row'
      onClick={props.onPick}
    >
      <span>{props.name}</span>
      {props.on && <Check aria-hidden='true' />}
    </button>
  )
}
