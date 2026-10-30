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
// The home page's first screen, in words: night-sea-home.tsx shows them, and
// so does the first screen sent with the page's HTML (hero-shell-html.ts).
// Plain values, no DOM: the build reads this file.

/** The first screen's words */
export const HERO = {
  title: ['你的海如此辽阔', '我的船如此渺小'],
  poem: ['今晚仰望星空', '格外心怀敬畏'],
  what: ['一个接口', '探索星辰大海'],
  start: '开始使用',
  docs: '阅读文档',
  more: '往下看看',
  prayer: 'Thy sea is so great and my boat is so small',
} as const

/** The first screen in the HTML, and its style */
export const HERO_SHELL_ID = 'ns-shell'
export const HERO_SHELL_STYLE_ID = 'ns-shell-css'
/** How long the HTML's poster and words take to come up; the app takes over no sooner after they do */
export const POSTER_FADE_MS = 600
export const WORDS_FADE_MS = 300
