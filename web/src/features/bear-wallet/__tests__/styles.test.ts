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

import { afterEach, describe, expect, it } from 'vitest'

const css = readFileSync(
  resolve(import.meta.dirname, '../bear-wallet.css'),
  'utf8'
)

afterEach(() => {
  document.head.innerHTML = ''
})

/** Every style rule of the sheet, with the @layer block it sits in */
function styleRules(): Array<{ rule: CSSStyleRule; layer: string | null }> {
  const style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  const found: Array<{ rule: CSSStyleRule; layer: string | null }> = []
  const walk = (rules: CSSRuleList, layer: string | null) => {
    for (const rule of rules) {
      if (rule instanceof CSSLayerBlockRule) walk(rule.cssRules, rule.name)
      else if (rule instanceof CSSMediaRule) walk(rule.cssRules, layer)
      else if (rule instanceof CSSStyleRule) found.push({ rule, layer })
    }
  }
  walk(style.sheet?.cssRules ?? new CSSRuleList(), null)
  return found
}

describe('wallet stylesheet', () => {
  it('draws its focus outline below utilities, so a Button keeps only its own ring', () => {
    const outlines = styleRules().filter(
      ({ rule }) =>
        rule.selectorText.includes(':focus-visible') &&
        rule.style.getPropertyValue('outline').includes('solid')
    )
    expect(outlines.length).toBeGreaterThan(0)
    for (const { layer } of outlines) expect(layer).toBe('components')
  })
})
