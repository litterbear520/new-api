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
import type { TFunction } from 'i18next'

import { newId } from '@/stores/bear-draw-store'

import type { BrandKit, ImageRef } from '../../types'

/** Most colours a kit keeps; the first is the main colour. */
export const MAX_BRAND_COLORS = 5

export type FontPreset = {
  id: 'modern' | 'serif' | 'round' | 'hand' | 'bold'
  /** Written into the kit as is: the planner reads Chinese. */
  value: string
  label: string
}

export function fontPresets(t: TFunction): FontPreset[] {
  return [
    { id: 'modern', value: '现代无衬线', label: t('Modern sans-serif') },
    { id: 'serif', value: '优雅衬线', label: t('Elegant serif') },
    { id: 'round', value: '圆润可爱', label: t('Round and cute') },
    { id: 'hand', value: '手写感', label: t('Handwritten') },
    { id: 'bold', value: '粗黑醒目', label: t('Heavy and bold') },
  ]
}

export type BrandColor = { id: string; value: string }

/** The editor's state: colours keep ids, selling points stay raw text. */
export type BrandKitDraft = {
  name: string
  colors: BrandColor[]
  fonts: string
  tone: string
  points: string
  logo: ImageRef | null
  notes: string
}

const DEFAULT_COLORS = ['#1F3A5F', '#E9E2D6']

export function draftFromKit(kit: BrandKit | null): BrandKitDraft {
  return {
    name: kit?.name ?? '',
    colors: (kit?.colors.length ? kit.colors : DEFAULT_COLORS).map((value) => ({
      id: newId('c'),
      value,
    })),
    fonts: kit?.fonts ?? '现代无衬线',
    tone: kit?.tone ?? '',
    points: (kit?.points ?? []).join('\n'),
    logo: kit?.logo ?? null,
    notes: kit?.notes ?? '',
  }
}

/** Selling points: one per line, blank lines dropped. */
export function splitPoints(text: string): string[] {
  return text
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
}

export function kitFromDraft(draft: BrandKitDraft): BrandKit {
  return {
    name: draft.name.trim(),
    colors: draft.colors.map((c) => c.value.toUpperCase()),
    fonts: draft.fonts.trim(),
    tone: draft.tone.trim(),
    points: splitPoints(draft.points),
    logo: draft.logo,
    notes: draft.notes.trim(),
  }
}
