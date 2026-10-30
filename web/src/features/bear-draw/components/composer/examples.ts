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
import { useEffect, useState } from 'react'

import { skillById } from '../../data/skills'
import type { Skill } from '../../types'

const ROTATE_MS = 4200

/** One example in the home composer's placeholder; Tab fills it in. */
export type Example = { text: string; skillId: string | null }

/** Index of the example shown; moves on every few seconds while `on`. */
export function useRotation(on: boolean): number {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setIndex((i) => i + 1), ROTATE_MS)
    return () => clearInterval(id)
  }, [on])
  return index
}

/** The home placeholder's examples, each with the skill that does it. */
export function getExamples(t: TFunction): Example[] {
  return [
    {
      text: t('Make a set of Taobao main pictures for my insulated bottle'),
      skillId: 'taobao-main-set',
    },
    {
      text: t(
        'Design a logo for the café “Shanye”, then cup sleeve and paper bag mockups'
      ),
      skillId: 'logo-mockup',
    },
    {
      text: t(
        'A Double 11 sale poster for noise-cancelling headphones, final price 399'
      ),
      skillId: 'promo-poster',
    },
    {
      text: t('Xiaohongshu cover: an honest review of a winter hand cream'),
      skillId: 'xhs-cover',
    },
    {
      text: t('Put this product shot in a Nordic living room'),
      skillId: null,
    },
  ]
}

/** A built-in skill or one of the user's own. */
export function findSkill(id: string | null, mine: Skill[]): Skill | null {
  if (!id) return null
  return mine.find((s) => s.id === id) ?? skillById(id) ?? null
}
