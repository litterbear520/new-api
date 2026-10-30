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
import raw from './ad-law-words.json'

/*
 * Words the advertising law (广告法 and related rules) makes risky in
 * in-picture copy: data/ad-law-words.json, common knowledge collected by
 * hand, not legal advice. lib/adlaw.ts finds and replaces them.
 */

/**
 * ban: don't use; evidence: only with real proof (report, patent number,
 * sales data) named in the copy; category: only for drugs, medical devices,
 * health food or registered special cosmetics.
 */
export type AdLawLevel = 'ban' | 'evidence' | 'category'

export type AdLawWord = {
  w: string
  /** The word's own level, else its group's. */
  level: AdLawLevel
  /** What to write instead (Chinese prose). */
  suggest: string
  /** prefix: every word starting with `w` (最…) except `except`. */
  match?: 'prefix'
  /** Longer words containing `w` that are fine (最近, 最后…). */
  except?: string[]
  example?: string
}

export type AdLawGroup = {
  id: string
  name: string
  level: AdLawLevel
  /** Ids in AD_LAW_BASIS. */
  basis: string[]
  words: AdLawWord[]
}

/** A law or rule the list is based on. */
export type AdLawBasis = { id: string; name: string; summary: string }

type RawWord = Omit<AdLawWord, 'level' | 'match'> & {
  level?: string
  match?: string
}

const FILE: {
  note: string
  updated: string
  basis: AdLawBasis[]
  groups: Array<
    Omit<AdLawGroup, 'level' | 'words'> & {
      level: string
      words: RawWord[]
    }
  >
} = raw

function toLevel(level: string | undefined, fallback: AdLawLevel): AdLawLevel {
  if (level === 'ban' || level === 'evidence' || level === 'category') {
    return level
  }
  return fallback
}

/** How to use the list, in Chinese (only a hint, the user decides). */
export const AD_LAW_NOTE: string = FILE.note

export const AD_LAW_BASIS: AdLawBasis[] = FILE.basis

export const AD_LAW_GROUPS: AdLawGroup[] = FILE.groups.map((g) => {
  const level = toLevel(g.level, 'ban')
  return {
    id: g.id,
    name: g.name,
    level,
    basis: g.basis,
    words: g.words.map((w) => ({
      w: w.w,
      level: toLevel(w.level, level),
      suggest: w.suggest,
      ...(w.match === 'prefix' ? { match: 'prefix' as const } : {}),
      ...(w.except ? { except: w.except } : {}),
      ...(w.example ? { example: w.example } : {}),
    })),
  }
})
