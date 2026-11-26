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
  useImperativeHandle,
  type Dispatch,
  type ForwardedRef,
  type RefObject,
  type SetStateAction,
} from 'react'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { RATIOS } from '../../constants'
import type { GalleryItem } from '../../data/gallery'
import type { Attachment, Ratio } from '../../types'
import type { Preset } from './composer-chips'

/** What the page can do to the composer: starters, 玩法, canvas edits. */
export type ComposerHandle = {
  focus(): void
  setText(text: string): void
  /**
   * Adds to what is already typed (the notes of a 圈选). `replaces` is the
   * text this one takes the place of when it is still there.
   */
  appendText(text: string, replaces?: string): void
  setSkill(skillId: string | null): void
  applyPreset(item: GalleryItem): void
  /** False when the message already holds as many pictures as it can. */
  addRefs(refs: Attachment[]): boolean
  /** Picture files dropped on the page: stored, then attached. */
  addFiles(files: File[]): void
}

const isRatio = (r: unknown): r is Ratio => RATIOS.includes(r as Ratio)

/** The 玩法's photo hint without markdown and its 「输入：」 lead. */
const cleanHint = (hint: unknown) =>
  String(hint ?? '')
    .replaceAll('**', '')
    .replace(/^(Input|输入)[:：]\s*/i, '')
    .trim()

export function useComposerHandle(
  ref: ForwardedRef<ComposerHandle>,
  taRef: RefObject<HTMLTextAreaElement | null>,
  write: (value: string, caret: number) => void,
  setSkillId: (id: string | null) => void,
  setPreset: Dispatch<SetStateAction<Preset | null>>,
  addRefs: (list: Attachment[]) => boolean,
  addFiles: (files: File[]) => Promise<unknown>
) {
  const setPrefs = useBearDrawStore((s) => s.setPrefs)
  useImperativeHandle(
    ref,
    () => ({
      focus: () => taRef.current?.focus({ preventScroll: true }),
      setText: (value) => {
        write(value, value.length)
        taRef.current?.focus({ preventScroll: true })
      },
      appendText: (value, replaces) => {
        const typed = taRef.current?.value.trim() ?? ''
        let next = value
        if (replaces && typed.includes(replaces)) {
          next = typed.replace(replaces, value)
        } else if (typed.includes(value)) next = typed
        else if (typed) next = `${typed}\n${value}`
        write(next, next.length)
        taRef.current?.focus({ preventScroll: true })
      },
      setSkill: (id) => {
        setSkillId(id)
        if (id && useBearDrawStore.getState().prefs.mode !== 'agent') {
          setPrefs({ mode: 'agent' })
        }
        taRef.current?.focus({ preventScroll: true })
      },
      // a 玩法: Image mode, its ratio, its prompt; maybe a photo first
      applyPreset: (item) => {
        const modeBefore = useBearDrawStore.getState().prefs.mode
        // a 玩法 is one opaque picture, whatever the last message used
        setPrefs({
          mode: 'image',
          count: 1,
          transparent: false,
          ...(isRatio(item.ratio) ? { ratio: item.ratio } : {}),
        })
        setSkillId(null)
        setPreset((earlier) => ({
          id: item.id,
          title: item.title,
          needsPhoto: Boolean(item.needsPhoto),
          hint: cleanHint(item.inputHint),
          prompt: item.prompt,
          // a second 玩法 over the first: still the mode from before both
          modeBefore: earlier?.modeBefore ?? modeBefore,
        }))
        write(item.prompt, 0)
        const ta = taRef.current
        if (ta) {
          ta.focus({ preventScroll: true })
          ta.scrollTop = 0
        }
      },
      addRefs: (list) => {
        const added = addRefs(list)
        taRef.current?.focus({ preventScroll: true })
        return added
      },
      addFiles: (files) => {
        void addFiles(files)
        taRef.current?.focus({ preventScroll: true })
      },
    }),
    [taRef, write, setSkillId, setPreset, addRefs, addFiles, setPrefs]
  )
}
