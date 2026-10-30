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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { estimatePicture, isBusy, type SendInput } from '../../lib/engine'
import type { Preset } from './composer-chips'
import { findSkill, getExamples, useRotation } from './examples'
import { insertTrigger, replaceTrigger } from './trigger'
import { useAttachments } from './use-attachments'
import { useComposerHandle, type ComposerHandle } from './use-handle'
import { usePicker, type PickItem } from './use-picker'

export type ComposerProps = {
  variant: 'home' | 'dock'
  projectId?: string
  busy?: boolean
  onSend: (input: SendInput) => void
  onStop?: () => void
  /** Meteors in the sky (home, plain dark): the bear has noticed them */
  notice?: boolean
  /** The bear was clicked about them: its tip to wish on one */
  hint?: boolean
  onNotice?: () => void
}

const MAX_HEIGHT = { home: 200, dock: 180 }

/**
 * What the composer holds and does: the text, skill, 玩法 and pictures of
 * the message being written, the pickers, sending, and the handle the page
 * uses to fill it in.
 */
export function useComposer(
  props: ComposerProps,
  ref: ForwardedRef<ComposerHandle>,
  focused: boolean
) {
  const { t } = useTranslation()
  const mode = useBearDrawStore((s) => s.prefs.mode)
  const imageModel = useBearDrawStore((s) => s.prefs.image)
  const count = useBearDrawStore((s) => s.prefs.count)
  const transparent = useBearDrawStore((s) => s.prefs.transparent)
  const setPrefs = useBearDrawStore((s) => s.setPrefs)
  const mySkills = useBearDrawStore((s) => s.mySkills)
  // re-render on every phase so isBusy below stays fresh
  const live = useBearDrawStore((s) =>
    props.projectId ? s.live[props.projectId] : null
  )
  const [text, setText] = useState('')
  const [skillId, setSkillId] = useState<string | null>(null)
  const [preset, setPreset] = useState<Preset | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const att = useAttachments()

  // Image mode can always send: its pictures draw side by side (≤3 at once,
  // the rest queue unsent). Only an Agent turn holds the box (and offers ■).
  const busy =
    mode === 'agent' &&
    (props.busy ?? (props.projectId ? isBusy(props.projectId) : false))
  const skill = findSkill(skillId, mySkills)
  const examples = useMemo(() => getExamples(t), [t])
  const exampleOn = props.variant === 'home' && mode === 'agent' && !skill
  const turn = useRotation(exampleOn && !text && !focused)
  const example = exampleOn ? examples[turn % examples.length] : null
  const refs = att.refs
  const needPhoto = preset?.needsPhoto === true && refs.length === 0
  const hasBody = text.trim() !== '' || (preset != null && refs.length > 0)
  const one =
    mode === 'image'
      ? estimatePicture(imageModel, {
          edit: refs.length > 0,
          refs: refs.length,
          transparent,
        })
      : null

  /** Sets the text and where the caret goes after the render. */
  const write = useCallback((value: string, at: number) => {
    const ta = taRef.current
    if (ta && ta.value === value) {
      // same text: no render will come to place the caret
      ta.setSelectionRange(at, at)
      return
    }
    setText(value)
    caret.current = at
  }, [])

  const picker = usePicker({
    projectId: props.projectId,
    onChoose: (item: PickItem, trigger) => {
      if (item.kind === 'skill') {
        const next = replaceTrigger(text, trigger, '')
        write(next.value, next.caret)
        setSkillId(item.skill.id)
        if (mode !== 'agent') setPrefs({ mode: 'agent' })
        return
      }
      const img = item.pick.node.img
      if (!img) return
      const label = item.pick.label
      if (!att.add([{ ...img, nodeId: item.pick.node.id, label }])) return
      const spaced = /^\s/.test(text.slice(trigger.end))
      const next = replaceTrigger(
        text,
        trigger,
        `@${label}${spaced ? '' : ' '}`
      )
      write(next.value, next.caret)
    },
  })

  // grow with the text; put the caret where an edit left it
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT[props.variant])}px`
    if (caret.current != null) {
      ta.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  }, [text, props.variant])

  const send = () => {
    if (busy) return
    if (needPhoto) {
      toast(t('Add a photo of your own first for this preset'))
      fileRef.current?.click()
      return
    }
    if (!hasBody) {
      taRef.current?.focus()
      return
    }
    const input: SendInput = { text: text.trim(), mode, refs }
    if (mode === 'agent' && skill) input.skillId = skill.id
    if (preset) input.presetId = preset.id
    props.onSend(input)
    setText('')
    setSkillId(null)
    setPreset(null)
    att.clear()
    picker.close()
  }

  /** "/" or "@" from the + menu, typed into the text so typing filters. */
  const startPicker = (mark: '/' | '@') => {
    const at = taRef.current?.selectionStart ?? text.length
    const next = insertTrigger(text, at, mark)
    write(next.value, next.caret)
    picker.evaluate(next.value, next.caret)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // the Enter that ends an IME composition is not a send
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (picker.onKey(e)) return
    if (e.key === 'Tab' && !e.shiftKey && !text && example) {
      e.preventDefault()
      write(example.text, example.text.length)
      const s = findSkill(example.skillId, mySkills)
      if (s) setSkillId(s.id)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  useComposerHandle(ref, taRef, write, setSkillId, setPreset, att.add)

  return {
    mode,
    live,
    busy,
    text,
    setText,
    skill,
    clearSkill: () => setSkillId(null),
    preset,
    clearPreset: () => setPreset(null),
    example,
    turn,
    att,
    needPhoto,
    ready: !busy && !needPhoto && hasBody,
    estimate: one == null ? null : one * count,
    picker,
    taRef,
    fileRef,
    send,
    startPicker,
    onKeyDown,
  }
}
