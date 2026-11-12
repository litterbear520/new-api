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
import { describe, expect, test } from 'vitest'

import type { Conversation } from '../../types'
import { importable } from '../transfer'

const conv = (id: string): Conversation => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  turns: [],
})

describe('importable', () => {
  test('chats from the file get new ids; ones this account has are skipped', () => {
    let n = 0
    const out = importable(
      [conv('mine'), conv('from-a')],
      new Set(['mine']),
      () => `new${++n}`
    )
    expect(out.map((c) => c.id)).toEqual(['new1'])
    expect(out[0].title).toBe('from-a')
  })
})
