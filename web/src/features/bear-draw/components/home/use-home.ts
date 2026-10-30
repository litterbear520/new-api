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
import { useEffect, useState, type RefObject } from 'react'

import { useBearDrawStore } from '@/stores/bear-draw-store'

import type { ComposerHandle } from '../composer/composer'
import { loadGallery } from '../gallery/use-gallery'
import { warmProject } from '../lazy-views'

/**
 * A draft left for the home page (「试用此技能」 on the skills page, a 玩法
 * from elsewhere) goes into the composer once, then is cleared.
 */
export function useHomeDraft(composer: RefObject<ComposerHandle | null>) {
  const draft = useBearDrawStore((s) => s.draft)
  useEffect(() => {
    const c = composer.current
    if (!draft || !c) return
    const store = useBearDrawStore.getState()
    store.setDraft(null)
    if (draft.mode !== store.prefs.mode) store.setPrefs({ mode: draft.mode })
    if (draft.refs.length) c.addRefs(draft.refs)
    if (draft.skillId) c.setSkill(draft.skillId)
    if (draft.text) c.setText(draft.text)
    const presetId = draft.presetId
    if (presetId) {
      loadGallery()
        .then((g) => {
          const item = g.GALLERY.find((it) => it.id === presetId)
          if (item) composer.current?.applyPreset(item)
        })
        .catch(() => undefined)
    }
    c.focus()
  }, [draft, composer])
}

/** True once `target` has scrolled out of `root`. */
export function useScrolledAway(
  root: RefObject<HTMLElement | null>,
  target: RefObject<HTMLElement | null>
): boolean {
  const [away, setAway] = useState(false)
  useEffect(() => {
    const r = root.current
    const el = target.current
    if (!r || !el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => setAway(!(entries.at(-1)?.isIntersecting ?? true)),
      { root: r, threshold: 0 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [root, target])
  return away
}

/**
 * Typing or pressing in `target` (the composer, the recent projects) means a
 * project is next: start loading the project page's chunk.
 */
export function useWarmOnUse(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = target.current
    if (!el) return
    const events = ['keydown', 'pointerdown', 'pointerover'] as const
    for (const e of events) el.addEventListener(e, warmProject, { once: true })
    return () => {
      for (const e of events) el.removeEventListener(e, warmProject)
    }
  }, [target])
}
