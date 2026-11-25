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
import { describe, expect, it } from 'vitest'

import type { Ctx } from '../lib/canvas/context'
import { DEFAULT_LABELS } from '../lib/canvas/labels'
import { toolbarList } from '../lib/canvas/toolbar'

describe('several pictures selected on the canvas', () => {
  const ctx = (ids: string[], failed: string[] = []) =>
    ({
      o: {},
      L: DEFAULT_LABELS,
      sel: new Set(ids),
      nodes: new Map(
        ids.map((id) => [
          id,
          { status: failed.includes(id) ? 'failed' : 'ready' },
        ])
      ),
    }) as unknown as Ctx
  const has = (c: Ctx) => toolbarList(c, 'multi').some((a) => a.id === 'cite')

  it('offers 引用到对话 for 2 to 4 finished pictures', () => {
    expect(has(ctx(['a', 'b']))).toBe(true)
    expect(has(ctx(['a', 'b', 'c', 'd']))).toBe(true)
    expect(has(ctx(['a', 'b', 'c', 'd', 'e']))).toBe(false)
    expect(has(ctx(['a', 'b'], ['b']))).toBe(false)
  })
})
