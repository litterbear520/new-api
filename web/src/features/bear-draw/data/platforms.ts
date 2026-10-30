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
import raw from './platform-specs.json'

/*
 * Picture specs of Chinese platforms (data/platform-specs.json, collected by
 * hand on 2026-10-25). Sizes are width×height in pixels.
 */

export type PlatformItem = {
  id: string
  name: string
  /** May be a ratio the image models don't take, e.g. 6:7 (export crops). */
  ratio?: string
  /** e.g. "800×800". */
  size?: string
  w?: number
  h?: number
  /** Detail pages: width only. */
  width?: number
  minSize?: string
  maxFileMB?: number
  formats?: string[]
  /** Pictures in a set, e.g. 5 main pictures. */
  count?: number
  rules?: string[]
  /** Keep titles and faces inside this box (pixels of the full size). */
  safeZone?: { x: number; y: number; w: number; h: number; note?: string }
  /** No official page found, only third-party write-ups: check before use. */
  verify: boolean
  /** Pages the spec was taken from. */
  sources: string[]
}

export type Platform = { id: string; name: string; items: PlatformItem[] }

/** What the planner gets for one platform (no ids or source links). */
export type PlatformSpec = {
  platform: string
  items: Array<Omit<PlatformItem, 'id' | 'sources'>>
}

type Crop = { from: string; keep: string; cut?: string }

const FILE: {
  note: string
  updated: string
  render: { note: string; outputs: string[]; crops: Record<string, Crop> }
  platforms: Platform[]
} = raw

export const PLATFORMS: Platform[] = FILE.platforms

/** How the spec list should be read (verify, sizes), in Chinese. */
export const PLATFORM_NOTE: string = FILE.note

/**
 * What the image models really return (they ignore `size`): the three
 * output sizes and how each ratio is cropped from them.
 */
export const RENDER_SPECS = FILE.render

function key(name: string): string {
  return name.trim().toLowerCase()
}

const BY_KEY = new Map<string, Platform>(
  PLATFORMS.flatMap((p): Array<[string, Platform]> => [
    [key(p.name), p],
    [key(p.id), p],
  ])
)

/** A platform by its Chinese name (淘宝) or id (taobao). */
export function platformByName(name: string): Platform | undefined {
  return BY_KEY.get(key(name))
}

/**
 * Specs for the given platform names, in that order; names without specs
 * (通用, 朋友圈…) are skipped.
 */
export function specsFor(names: string[]): PlatformSpec[] {
  const seen = new Set<string>()
  const out: PlatformSpec[] = []
  for (const name of names) {
    const p = platformByName(name)
    if (!p || seen.has(p.id)) continue
    seen.add(p.id)
    out.push({
      platform: p.name,
      items: p.items.map((it) => {
        const { id: _id, sources: _sources, ...spec } = it
        return spec
      }),
    })
  }
  return out
}
