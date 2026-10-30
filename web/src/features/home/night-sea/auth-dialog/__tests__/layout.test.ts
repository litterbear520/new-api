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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/** The hint under the provider buttons (「第三方登录将跳转到主线路 …」); night-sea-auth-dialog.test.tsx checks the DOM matches it */
const MAIN_LINE_HINT = ".ns-auth [data-slot='button'] ~ p"

type Declaration = { property: string; value: string; blocks: string[] }

/** Each declaration of the dialog's CSS with the rules and at-rules it sits in. */
function declarations(): Declaration[] {
  const css = readFileSync(
    resolve(import.meta.dirname, '../auth-dialog.css'),
    'utf8'
  ).replaceAll(/\/\*[\s\S]*?\*\//g, '')
  const out: Declaration[] = []
  const blocks: string[] = []
  for (const match of css.matchAll(/([^{};]+)\{|\}|([^{};:]+):([^{};]+);/g)) {
    if (match[1] !== undefined) {
      blocks.push(match[1].trim().replaceAll(/\s+/g, ' '))
    } else if (match[0] === '}') {
      blocks.pop()
    } else {
      out.push({
        property: match[2].trim(),
        value: match[3].trim().replaceAll(/\s+/g, ' '),
        blocks: [...blocks],
      })
    }
  }
  return out
}

const css = declarations()
const card = (media: string[], property: string) =>
  css
    .filter(
      (d) =>
        d.property === property &&
        d.blocks.join(' | ') ===
          [...media, '.ns-auth.auth-cosmos.dark'].join(' | ')
    )
    .map((d) => d.value)

describe('auth dialog layout', () => {
  it('limits the desktop card to the viewport height left below its top offset', () => {
    expect(card([], 'top')).toEqual(['var(--ns-auth-top, 12vh)'])
    const heights = card([], 'max-height')
    expect(heights.length).toBeGreaterThan(0)
    for (const height of heights) {
      expect(height).toMatch(
        /^calc\(100d?vh - var\(--ns-auth-top, 12vh\) - 16px\)$/
      )
    }
  })

  it('limits the phone sheet to the viewport height above its bottom gap', () => {
    const phone = ['@media (max-width: 640px)']
    expect(card(phone, 'top')).toEqual(['auto'])
    expect(card(phone, 'bottom')).toEqual([
      'max(8px, env(safe-area-inset-bottom))',
    ])
    for (const height of card(phone, 'max-height')) {
      const gap = Number(/^calc\(100d?vh - (\d+)px\)$/.exec(height)?.[1])
      expect(gap, height).toBeGreaterThanOrEqual(8 + 16)
    }
  })

  it('sets the main-line hint off the bright sky behind the glass', () => {
    const hint = css.filter((d) => d.blocks.at(-1) === MAIN_LINE_HINT)
    expect(hint.map((d) => d.property)).toContain('text-shadow')
  })
})
