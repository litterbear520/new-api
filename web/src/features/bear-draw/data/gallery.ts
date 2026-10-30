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
import { RATIOS } from '../constants'
import type { Ratio } from '../types'
import { GALLERY_IMAGES } from './gallery-images'
import raw from './gallery.json'

/*
 * 「玩法」: one-click prompts from open-source prompt collections, with their
 * sample pictures. About 150 KB plus 86 picture URLs, so load this module
 * with import() where it is shown; `import type` is free.
 */

export type GalleryItem = {
  id: string
  title: string
  /** One of GALLERY_CATEGORIES. */
  category: string
  /** The prompt edits the user's own photo. */
  needsPhoto: boolean
  /** 小熊's pick: listed first. */
  featured: boolean
  ratio: Ratio
  /** How striking the sample is (1–5); orders the unpicked items. */
  wow: number
  /** Why it is worth a try (may be empty). */
  why: string
  /** Verbatim from the source collection. */
  prompt: string
  /** The prompt with {argument name="…" default="…"} slots, when it has any. */
  template: string | null
  /** The same prompt in another language, from the same source. */
  promptAlt: { lang: string; prompt: string; note?: string } | null
  /** Language of `prompt`: zh, en or ja. */
  lang: string
  /** What the user should upload, in the source's words. */
  inputHint: string | null
  author: { name: string; url: string | null }
  /** The original post. */
  post: string
  /** The collection, e.g. renoise-ai/awesome-gpt-image-2-5-prompts. */
  repo: string
  repoUrl: string
  /** The entry inside the collection. */
  url: string
  license: string
  /** Model the prompt was written for, e.g. gpt-image-2.5, nano-banana. */
  modelOrigin: string
  /** Card picture (≤600 px wide). */
  cover: string
  /** The card picture at 400 px wide, for plain (1x) screens; `cover` when there is none. */
  coverSmall: string
  /** Detail picture (≤1200 px long side; the card picture when that is all there is). */
  coverLarge: string
  /** The photo the sample was made from, for before/after items. */
  before: string | null
  beforeLarge: string | null
  /** More samples (card size). */
  more: string[]
  /** Size of the sample picture. */
  w: number
  h: number
}

type RawItem = Omit<
  GalleryItem,
  | 'featured'
  | 'ratio'
  | 'template'
  | 'coverLarge'
  | 'beforeLarge'
  | 'cover'
  | 'coverSmall'
  | 'before'
> & {
  featured?: boolean
  ratio: string
  template?: string | null
  /** Paths like assets/gallery/<name>.jpg in the prototype. */
  cover: string
  before: string | null
}

const FILE: { categories: string[]; items: RawItem[] } = raw

/** The picture sizes converted from a prototype path. */
function pictures(
  path: string
): { s: string; xs: string; l: string } | undefined {
  const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.\w+$/, '')
  return Object.hasOwn(GALLERY_IMAGES, name) ? GALLERY_IMAGES[name] : undefined
}

function toItem(it: RawItem): GalleryItem | null {
  const cover = pictures(it.cover)
  if (!cover) return null
  const before = it.before ? pictures(it.before) : undefined
  return {
    ...it,
    featured: Boolean(it.featured),
    ratio: RATIOS.find((r) => r === it.ratio) ?? 'auto',
    template: it.template ?? null,
    promptAlt: it.promptAlt
      ? {
          lang: it.promptAlt.lang,
          prompt: it.promptAlt.prompt,
          ...(it.promptAlt.note ? { note: it.promptAlt.note } : {}),
        }
      : null,
    cover: cover.s,
    coverSmall: cover.xs,
    coverLarge: cover.l,
    before: before?.s ?? null,
    beforeLarge: before?.l ?? null,
    more: it.more.flatMap((m) => pictures(m)?.s ?? []),
  }
}

/** 小熊's picks first, then the GPT Image 2.5 originals, then the rest by wow. */
function rank(it: GalleryItem): number {
  if (it.featured) return 0
  return it.modelOrigin === 'gpt-image-2.5' ? 1 : 2
}

export const GALLERY_CATEGORIES: string[] = FILE.categories

/** In display order (Array.prototype.sort is stable, so ties keep file order). */
export const GALLERY: GalleryItem[] = FILE.items
  .flatMap((it) => toItem(it) ?? [])
  .sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? b.wow - a.wow : 0))
