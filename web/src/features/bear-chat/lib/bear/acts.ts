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
export type BearAct =
  | 'idle'
  | 'look'
  | 'stretch'
  | 'scratch'
  | 'waddle'
  | 'cocoa'
  | 'fish'
  | 'stargaze'
  | 'sing'
  | 'yawn'
  | 'sleep'
  | 'watch'
  | 'think'
  | 'scope'
  | 'read'
  | 'book'
  | 'calc'
  | 'write'
  | 'code'
  | 'web'
  | 'translate'
  | 'bell'
  | 'wand'
  | 'tap'
  | 'phones'
  | 'done'
  | 'error'
  | 'startled'
  | 'heart'
  | 'shy'
  | 'flag'
  | 'thumbs'
  | 'greet'
  | 'peek'
  | 'drop'
  | 'tickle'
  | 'wink'
  | 'sneeze'
  | 'spin'
  | 'skip'
  | 'coin'

/** One-shot acts and how long they play (ms); afterwards the bear goes back. */
export const ONCE: Partial<Record<BearAct, number>> = {
  done: 1600,
  tickle: 320,
  greet: 2200,
  wink: 380,
  look: 1700,
  stretch: 2000,
  scratch: 1800,
  waddle: 2400,
  yawn: 1700,
  peek: 1500,
  drop: 1000,
  sneeze: 720,
  spin: 1140,
  coin: 1350,
  startled: 950,
  heart: 1900,
  shy: 2100,
  thumbs: 1300,
  skip: 900,
  tap: 1300,
}

/** Idle loops that end by themselves after a while (ms). */
export const LOOP_FOR: Partial<Record<BearAct, number>> = {
  fish: 13000,
  stargaze: 9000,
  cocoa: 10000,
  wand: 6200,
  sing: 4600,
  flag: 4200,
  error: 3600,
}

/** Acts that may be interrupted at once, without the 2 s minimum. */
export const SOFT: ReadonlySet<BearAct> = new Set<BearAct>([
  'idle',
  'watch',
  'sleep',
  'sing',
  'cocoa',
  'fish',
  'stargaze',
  'flag',
])

/** Reactions to a click; picked at random. */
export const POKES: BearAct[] = ['tickle', 'wink', 'sneeze', 'spin', 'skip']

/** Work acts with a status line next to the bear. */
export const WORKING: ReadonlySet<BearAct> = new Set<BearAct>([
  'think',
  'scope',
  'read',
  'book',
  'calc',
  'write',
  'code',
  'web',
  'translate',
  'bell',
  'wand',
  'phones',
])
