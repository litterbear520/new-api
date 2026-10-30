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

import { DRAW_TOKEN_NAME } from '@/features/draw/constants'
import type { ApiKey } from '@/features/keys/types'

import { keyRows, recentKey, spendByKey } from '../keys'

const key = (over: Partial<ApiKey>): ApiKey => ({
  id: 1,
  name: 'key',
  key: 'abcd****wxyz',
  status: 1,
  remain_quota: 0,
  used_quota: 0,
  unlimited_quota: true,
  expired_time: -1,
  created_time: 100,
  accessed_time: 0,
  group: '',
  auto_groups: null,
  cross_group_retry: false,
  model_limits_enabled: false,
  model_limits: '',
  allow_ips: '',
  allow_user_quota_query: false,
  ...over,
})

describe('recentKey', () => {
  test('offers the key used last and never the draw page key', () => {
    const keys = [
      key({ id: 1, name: 'Codex', accessed_time: 500 }),
      key({ id: 2, name: DRAW_TOKEN_NAME, accessed_time: 900 }),
      key({ id: 3, name: 'Claude Code', accessed_time: 800 }),
      key({ id: 4, name: 'Old', accessed_time: 950, status: 2 }),
    ]
    expect(recentKey(keys)?.name).toBe('Claude Code')
  })

  test('with no usable key there is nothing to offer', () => {
    expect(recentKey([key({ status: 3 })])).toBeNull()
  })
})

describe('keyRows', () => {
  test('keys with a limit come first, fullest first, then the biggest spenders', () => {
    const keys = [
      key({ id: 1, name: 'Free A' }),
      key({
        id: 2,
        name: 'Capped half',
        unlimited_quota: false,
        remain_quota: 50,
        used_quota: 50,
      }),
      key({ id: 3, name: 'Free B' }),
      key({
        id: 4,
        name: 'Capped full',
        unlimited_quota: false,
        remain_quota: 0,
        used_quota: 80,
        status: 4,
      }),
      key({ id: 5, name: 'Disabled', status: 2 }),
    ]
    const rows = keyRows(
      keys,
      new Map([
        [1, 10],
        [3, 40],
      ])
    )
    expect(rows.map((row) => row.key.name)).toEqual([
      'Capped full',
      'Capped half',
      'Free B',
      'Free A',
    ])
    expect(rows[1].usedShare).toBe(0.5)
    expect(rows[2].recent).toBe(40)
  })
})

describe('spendByKey', () => {
  test('adds up the flow rows per key', () => {
    const spend = spendByKey([
      { token_id: 7, quota: 3 },
      { token_id: 7, quota: 4 },
      { token_id: 0, quota: 9 },
    ])
    expect(spend.get(7)).toBe(7)
    expect(spend.has(0)).toBe(false)
  })
})
