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
import type { GalleryItem } from '../../data/gallery'

/** Widths of the card pictures: `-s` files and the `-xs` copies for plain screens. */
export const COVER_W = 600
export const COVER_SMALL_W = 400

/** The prompt in the other language, if the collection has one. */
export function altPrompt(item: GalleryItem): string | null {
  const alt = item.promptAlt?.prompt
  return alt?.trim() ? alt : null
}

/** A prompt language's own name, for the 中/EN switch. */
export function langName(code: string | undefined): string {
  if (code === 'en') return 'English'
  if (code === 'ja') return '日本語'
  return '中文'
}

/** Prompts written for another model (Nano Banana…) come out differently. */
export function foreignModel(item: GalleryItem): string | null {
  const origin = item.modelOrigin
  if (!origin || /gpt-image/i.test(origin)) return null
  if (origin === 'nano-banana') return 'Nano Banana'
  if (origin === 'nano-banana-pro') return 'Nano Banana Pro'
  return origin
}

/** Badge on the card: before/after needs your photo; native GPT Image 2.5 output. */
export function cardBadge(item: GalleryItem): 'photo' | 'native' | null {
  if (item.before) return 'photo'
  if (item.modelOrigin === 'gpt-image-2.5') return 'native'
  return null
}

/** CSS aspect-ratio of the cover; unknown sizes show as 3:4. */
export function coverRatio(item: GalleryItem): string {
  return item.w && item.h ? `${item.w} / ${item.h}` : '3 / 4'
}
