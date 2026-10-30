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

import { expect, it } from 'vitest'

const css = readFileSync(
  resolve(import.meta.dirname, '../bear-chat.css'),
  'utf8'
)

// Where @property is unknown and motion is reduced, nothing ever sets
// --bc-v05-a: a bare var() would make the gradient invalid and the ring vanish.
it('reads the turning angle of the composer working light with a fallback, so the ring still shows without @property', () => {
  const reads = [...css.matchAll(/var\(\s*--bc-v05-a\s*([,)])/g)]
  expect(reads.length).toBeGreaterThan(0)
  for (const read of reads) expect(read[1]).toBe(',')
  expect(css).toContain('var(--bc-v05-a, 158deg)')
})
