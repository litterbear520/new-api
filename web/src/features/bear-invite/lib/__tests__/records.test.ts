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

import { INVITER_LOG_KEY, inviteRecords } from '../records'

const other = (key: string, quota: string) =>
  JSON.stringify({ content_parts: [{ key, params: { quota } }] })

describe('inviteRecords', () => {
  it('keeps only invite rewards, newest first, in dollars', () => {
    const records = inviteRecords([
      { id: 1, created_at: 100, other: other(INVITER_LOG_KEY, '＄5.000000') },
      {
        id: 2,
        created_at: 300,
        other: other('Check-in reward {{quota}}', '＄1.000000'),
      },
      { id: 3, created_at: 200, other: other(INVITER_LOG_KEY, '$2.500000') },
      { id: 4, created_at: 400, other: '' },
      { id: 5, created_at: 500, other: 'not json' },
    ])
    expect(records.map((r) => [r.id, r.usd])).toEqual([
      [3, 2.5],
      [1, 5],
    ])
  })

  it('keeps amounts in other units as written', () => {
    const [record] = inviteRecords([
      { id: 1, created_at: 1, other: other(INVITER_LOG_KEY, '¥36.000000') },
    ])
    expect(record).toMatchObject({ usd: null, raw: '¥36.000000' })
  })
})
