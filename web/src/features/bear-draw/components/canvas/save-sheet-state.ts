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
 * Which pictures the long-press sheet (save-sheet.tsx) shows. Outside React
 * so the canvas's 下载 action can open it.
 */

export type SavePicture = { id: string; label: string; w: number; h: number }

let shown: SavePicture[] = []
const listeners = new Set<() => void>()

/** Opens the sheet with these pictures; [] closes it. */
export function openSaveSheet(pictures: SavePicture[]) {
  shown = pictures
  for (const fn of listeners) fn()
}

export function subscribeSaveSheet(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export const shownPictures = () => shown

/**
 * WeChat (also WeCom) and QQ's own browsers, not the QQ Browser app: they
 * ignore download links.
 */
export function blocksDownloads(ua: string): boolean {
  return /MicroMessenger\//i.test(ua) || /\bQQ\/\d/i.test(ua)
}
