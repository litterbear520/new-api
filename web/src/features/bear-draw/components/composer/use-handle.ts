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
import { useImperativeHandle, type ForwardedRef, type RefObject } from 'react'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import { RATIOS } from '../../constants'
import type { GalleryItem } from '../../data/gallery'
import type { Attachment, Ratio } from '../../types'
import type { Preset } from './composer-chips'

/** What the page can do to the composer: starters, 玩法, canvas edits. */
export type ComposerHandle = {
  focus(): void
  setText(text: string): void
  setSkill(skillId: string | null): void
  applyPreset(item: GalleryItem): void
  addRefs(refs: Attachment[]): void
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
  setPreset: (preset: Preset | null) => void,
  addRefs: (list: Attachment[]) => boolean
) {
  const setPrefs = useBearDrawStore((s) => s.setPrefs)
  useImperativeHandle(
    ref,
    () => ({
      focus: () => taRef.current?.focus(),
      setText: (value) => {
        write(value, value.length)
        taRef.current?.focus()
      },
      setSkill: (id) => {
        setSkillId(id)
        if (id && useBearDrawStore.getState().prefs.mode !== 'agent') {
          setPrefs({ mode: 'agent' })
        }
        taRef.current?.focus()
      },
      // a 玩法: Image mode, its ratio, its prompt; maybe a photo first
      applyPreset: (item) => {
        setPrefs({
          mode: 'image',
          count: 1,
          ...(isRatio(item.ratio) ? { ratio: item.ratio } : {}),
        })
        setSkillId(null)
        setPreset({
          id: item.id,
          title: item.title,
          needsPhoto: Boolean(item.needsPhoto),
          hint: cleanHint(item.inputHint),
        })
        write(item.prompt, 0)
        const ta = taRef.current
        if (ta) {
          ta.focus()
          ta.scrollTop = 0
        }
      },
      addRefs: (list) => {
        addRefs(list)
        taRef.current?.focus()
      },
    }),
    [taRef, write, setSkillId, setPreset, addRefs, setPrefs]
  )
}
