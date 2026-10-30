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

/*
 * The 玩法 wall: a row-major masonry. Each card goes to the column that is
 * shortest so far, so the first cards form the top row and the order reads
 * left to right. Heights are in units of the column width.
 */

export const WALL = {
  minCols: 2,
  maxCols: 5,
  /** Width of one column plus the gap (px). */
  track: 224,
  gap: 14,
  /** Caption under each picture, in column widths. */
  caption: 0.18,
  /** Width used before the wall has been measured. */
  fallbackWidth: 1000,
} as const

export type WallSized = { w?: number | null; h?: number | null }

export type WallColumn<T> = { id: string; items: T[] }

/** Columns for a wall this wide (px): 2 to 5. */
export function columnCount(width: number): number {
  const w = width > 0 ? width : WALL.fallbackWidth
  const n = Math.floor((w + WALL.gap) / WALL.track)
  return Math.max(WALL.minCols, Math.min(WALL.maxCols, n))
}

/** Height of a card in column widths; pictures without a size count as 3:4. */
export function cardHeight(item: WallSized): number {
  const ratio = item.w && item.h ? item.h / item.w : 4 / 3
  return ratio + WALL.caption
}

/** Puts every item into the shortest column so far (leftmost on a tie). */
export function assignColumns<T extends WallSized>(
  items: readonly T[],
  cols: number
): WallColumn<T>[] {
  const n = Math.max(1, Math.floor(cols))
  const columns: WallColumn<T>[] = Array.from({ length: n }, (_, i) => ({
    id: `col-${i}`,
    items: [],
  }))
  const heights = columns.map(() => 0)
  for (const item of items) {
    const k = heights.indexOf(Math.min(...heights))
    columns[k].items.push(item)
    heights[k] += cardHeight(item)
  }
  return columns
}
