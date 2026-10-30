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
import adCreative1 from '@/assets/bear-draw/covers/ad-creative-1.webp'
import adCreative2 from '@/assets/bear-draw/covers/ad-creative-2.webp'
import beforeAfter1 from '@/assets/bear-draw/covers/before-after-1.webp'
import beforeAfter2 from '@/assets/bear-draw/covers/before-after-2.webp'
import brandVi1 from '@/assets/bear-draw/covers/brand-vi-1.webp'
import brandVi2 from '@/assets/bear-draw/covers/brand-vi-2.webp'
import detailPage1 from '@/assets/bear-draw/covers/detail-page-1.webp'
import detailPage2 from '@/assets/bear-draw/covers/detail-page-2.webp'
import liveDouyin1 from '@/assets/bear-draw/covers/live-douyin-1.webp'
import liveDouyin2 from '@/assets/bear-draw/covers/live-douyin-2.webp'
import logoMockup1 from '@/assets/bear-draw/covers/logo-mockup-1.webp'
import logoMockup2 from '@/assets/bear-draw/covers/logo-mockup-2.webp'
import packagingSystem1 from '@/assets/bear-draw/covers/packaging-system-1.webp'
import packagingSystem2 from '@/assets/bear-draw/covers/packaging-system-2.webp'
import promoPoster1 from '@/assets/bear-draw/covers/promo-poster-1.webp'
import promoPoster2 from '@/assets/bear-draw/covers/promo-poster-2.webp'
import styleTransfer1 from '@/assets/bear-draw/covers/style-transfer-1.webp'
import styleTransfer2 from '@/assets/bear-draw/covers/style-transfer-2.webp'
import taobaoMainSet1 from '@/assets/bear-draw/covers/taobao-main-set-1.webp'
import taobaoMainSet2 from '@/assets/bear-draw/covers/taobao-main-set-2.webp'
import whiteBackground1 from '@/assets/bear-draw/covers/white-background-1.webp'
import whiteBackground2 from '@/assets/bear-draw/covers/white-background-2.webp'
import xhsCover1 from '@/assets/bear-draw/covers/xhs-cover-1.webp'
import xhsCover2 from '@/assets/bear-draw/covers/xhs-cover-2.webp'

import { RATIOS } from '../constants'
import type {
  Deliverable,
  Ratio,
  Skill,
  SkillCategory,
  SkillSource,
} from '../types'
import raw from './skills.json'

/*
 * The 12 built-in skills (from the prototype's data/skills.json, runtime
 * fields only). Their SKILL.md texts load on demand: lib/skill-text.ts.
 */

type RawSkill = Omit<
  Skill,
  'category' | 'deliverables' | 'sources' | 'covers'
> & {
  category: string
  deliverables: Array<Omit<Deliverable, 'ratio'> & { ratio: string }>
  sources: SkillSource[]
}

const FILE: {
  categories: Array<{ id: string; name: string }>
  skills: RawSkill[]
} = raw

const CATEGORY_IDS: readonly string[] = [
  'ecom',
  'brand',
  'social',
  'ads',
  'pack',
] satisfies SkillCategory[]

function isCategory(id: string): id is SkillCategory {
  return CATEGORY_IDS.includes(id)
}

function toRatio(ratio: string): Ratio {
  return RATIOS.find((r) => r === ratio) ?? 'auto'
}

const COVERS: Record<string, string[]> = {
  'taobao-main-set': [taobaoMainSet1, taobaoMainSet2],
  'white-background': [whiteBackground1, whiteBackground2],
  'detail-page': [detailPage1, detailPage2],
  'xhs-cover': [xhsCover1, xhsCover2],
  'live-douyin': [liveDouyin1, liveDouyin2],
  'promo-poster': [promoPoster1, promoPoster2],
  'ad-creative': [adCreative1, adCreative2],
  'packaging-system': [packagingSystem1, packagingSystem2],
  'logo-mockup': [logoMockup1, logoMockup2],
  'brand-vi': [brandVi1, brandVi2],
  'before-after': [beforeAfter1, beforeAfter2],
  'style-transfer': [styleTransfer1, styleTransfer2],
}

/** Library tabs, in the prototype's order; names are data (Chinese). */
export const SKILL_CATEGORIES: Array<{ id: SkillCategory; name: string }> =
  FILE.categories.flatMap((c) =>
    isCategory(c.id) ? [{ id: c.id, name: c.name }] : []
  )

export const SKILLS: Skill[] = FILE.skills.flatMap((s) => {
  const category = s.category
  if (!isCategory(category)) return []
  return [
    {
      ...s,
      category,
      deliverables: s.deliverables.map((d) => ({
        ...d,
        ratio: toRatio(d.ratio),
      })),
      covers: COVERS[s.id] ?? [],
    },
  ]
})

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]))

/** A built-in skill (the user's own skills live in the store). */
export function skillById(id: string): Skill | undefined {
  return BY_ID.get(id)
}
