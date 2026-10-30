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

/*
 * Old in-app browsers (WeChat, QQ) and Safari before 15.4 drop any
 * declaration with svh / lvh / dvh. The first screen's children are absolute,
 * so a dropped `height: 100svh` leaves it 0 px tall under the next section.
 */
const NEW_UNIT = /\d(?:svh|lvh|dvh)\b/

type Declaration = {
  property: string
  value: string
  /** The rules and at-rules it sits in, outermost first */
  blocks: string[]
  /** The declaration just before it in the same block */
  previous: { property: string; value: string } | null
}

function declarations(css: string): Declaration[] {
  const out: Declaration[] = []
  const blocks: string[] = []
  const lastIn: ({ property: string; value: string } | null)[] = []
  const tokens = /([^{};]+)\{|\}|([^{};:]+):([^{};]+);/g
  for (const match of css
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(tokens)) {
    if (match[1] !== undefined) {
      blocks.push(match[1].trim())
      lastIn.push(null)
    } else if (match[0] === '}') {
      blocks.pop()
      lastIn.pop()
    } else {
      const property = match[2].trim()
      const value = match[3].trim().replaceAll(/\s+/g, ' ')
      out.push({
        property,
        value,
        blocks: [...blocks],
        previous: lastIn.at(-1) ?? null,
      })
      lastIn[lastIn.length - 1] = { property, value }
    }
  }
  return out
}

const read = (path: string) =>
  readFileSync(resolve(import.meta.dirname, path), 'utf8')

describe.each([
  ['night-sea.css', read('../night-sea.css')],
  ['auth-dialog.css', read('../auth-dialog/auth-dialog.css')],
])('%s', (_name, css) => {
  const uses = declarations(css).filter((d) => NEW_UNIT.test(d.value))

  it('puts a vh declaration before every property sized in svh, lvh or dvh', () => {
    const plain = uses.filter((d) => !d.property.startsWith('--'))
    expect(plain.length).toBeGreaterThan(0)
    for (const use of plain) {
      expect(use.previous, `${use.property}: ${use.value}`).toEqual({
        property: use.property,
        value: use.value.replaceAll(/(\d)(?:svh|lvh|dvh)\b/g, '$1vh'),
      })
    }
  })

  it('sets custom properties in the new units only where the browser has them', () => {
    // A custom property takes any value, so a vh line before it would never
    // be used: the svh value has to sit behind @supports.
    for (const use of uses.filter((d) => d.property.startsWith('--'))) {
      expect(
        use.blocks.some((block) => /^@supports\b.*svh/.test(block)),
        `${use.property}: ${use.value}`
      ).toBe(true)
    }
  })
})
