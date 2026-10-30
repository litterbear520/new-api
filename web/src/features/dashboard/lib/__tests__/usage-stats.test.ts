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

import {
  bucketUsage,
  slotFamilies,
  slotUnit,
  sortBreakdown,
  sumUsage,
  usageBy,
  usageByKey,
} from '../usage-stats'

const at = (text: string) => Math.floor(new Date(text).getTime() / 1000)

describe('usage stats', () => {
  it('uses hours up to two days and days beyond', () => {
    const start = new Date(2026, 9, 27, 0, 0, 0)
    expect(slotUnit(start, new Date(2026, 9, 27, 23, 59, 59))).toBe('hour')
    expect(slotUnit(start, new Date(2026, 9, 29, 0, 0, 0))).toBe('hour')
    expect(slotUnit(start, new Date(2026, 10, 2, 23, 59, 59))).toBe('day')
  })

  it('puts hourly rows into day slots by model family', () => {
    const rows = [
      {
        model_name: 'gpt-6.1-sol',
        created_at: at('2026-10-25T09:00:00'),
        quota: 10,
        count: 1,
        token_used: 100,
      },
      {
        model_name: 'claude-sonnet-4-6',
        created_at: at('2026-10-25T18:00:00'),
        quota: 5,
        count: 2,
        token_used: 50,
      },
      {
        model_name: 'gpt-6.1-sol',
        created_at: at('2026-10-27T01:00:00'),
        quota: 7,
        count: 1,
        token_used: 70,
      },
      // Before the range: ignored.
      {
        model_name: 'gpt-6.1-sol',
        created_at: at('2026-10-20T01:00:00'),
        quota: 99,
        count: 1,
        token_used: 1,
      },
    ]
    const slots = bucketUsage(
      rows,
      new Date('2026-10-25T00:00:00'),
      new Date('2026-10-27T23:59:59'),
      'day'
    )
    expect(slots).toHaveLength(3)
    expect(slots[0].values.quota).toMatchObject({ gpt: 10, claude: 5 })
    expect(slots[0].values.requests).toMatchObject({ gpt: 1, claude: 2 })
    expect(slots[1].values.quota.gpt).toBe(0)
    expect(slots[2].values.tokens.gpt).toBe(70)
    expect(slotFamilies(slots)).toEqual(['gpt', 'claude'])
  })

  it('makes 24 hour slots for one day', () => {
    const slots = bucketUsage(
      [
        {
          model_name: 'gemini-3.8-flash',
          created_at: at('2026-10-27T13:00:00'),
          quota: 3,
        },
      ],
      new Date('2026-10-27T00:00:00'),
      new Date('2026-10-27T23:59:59'),
      'hour'
    )
    expect(slots).toHaveLength(24)
    expect(slots[13].values.quota.gemini).toBe(3)
  })

  it('adds totals', () => {
    expect(
      sumUsage([
        { created_at: 0, quota: 2, count: 1, token_used: 10 },
        { created_at: 0, quota: 3, count: 4 },
      ])
    ).toEqual({ quota: 5, requests: 5, tokens: 10 })
  })

  it('groups by model and sorts by the chosen metric', () => {
    const rows = usageBy('model', [
      { model_name: 'a', created_at: 1, quota: 1, count: 9 },
      { model_name: 'b', created_at: 1, quota: 5, count: 1 },
      { model_name: 'a', created_at: 2, quota: 1, count: 9 },
    ])
    expect(sortBreakdown(rows, 'quota').map((r) => r.name)).toEqual(['b', 'a'])
    expect(sortBreakdown(rows, 'requests').map((r) => r.name)).toEqual([
      'a',
      'b',
    ])
    expect(rows.find((r) => r.name === 'a')?.logs).toEqual({ model: 'a' })
  })

  it('groups by user with the same totals, without a model family', () => {
    const rows = usageBy('user', [
      { username: 'bear', model_name: 'a', created_at: 1, quota: 2, count: 1 },
      { username: 'bear', model_name: 'b', created_at: 2, quota: 3, count: 2 },
      { username: '', model_name: 'a', created_at: 3, quota: 1, count: 1 },
    ])
    expect(rows).toEqual([
      {
        id: 'user:bear',
        name: 'bear',
        logs: { username: 'bear' },
        quota: 5,
        requests: 3,
        tokens: 0,
      },
      {
        id: 'user:-',
        name: '-',
        logs: undefined,
        quota: 1,
        requests: 1,
        tokens: 0,
      },
    ])
  })

  it('lists every key, unused ones too, and names deleted keys', () => {
    const rows = usageByKey(
      [
        {
          token_id: 1,
          token_name: 'Claude Code',
          model_name: 'x',
          quota: 4,
          count: 2,
        },
        {
          token_id: 1,
          token_name: 'Claude Code',
          model_name: 'y',
          quota: 1,
          count: 1,
        },
        { token_id: 9, token_name: '', model_name: 'x', quota: 2, count: 1 },
      ],
      [
        {
          id: 1,
          name: 'Claude Code',
          status: 1,
          created_time: 100,
          accessed_time: 500,
        },
        {
          id: 2,
          name: 'test',
          status: 1,
          created_time: 100,
          accessed_time: 100,
        },
      ],
      { deleted: (id) => `deleted ${id}`, unknown: 'unknown' }
    )
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]))
    expect(byName['Claude Code']).toMatchObject({
      quota: 5,
      requests: 3,
      lastUsed: 500,
    })
    expect(byName.test).toMatchObject({ quota: 0, lastUsed: null })
    expect(byName['deleted 9']).toMatchObject({ quota: 2, logs: undefined })
  })
})
