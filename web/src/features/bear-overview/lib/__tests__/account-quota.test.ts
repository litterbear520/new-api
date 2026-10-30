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
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  gmtLabel,
  newRequestId,
  parseAccountQuota,
  parseResetReply,
  planLabel,
  quotaLevel,
  resetExpiry,
  resetTime,
} from '../account-quota'

const reply = {
  account: {
    group: 'team_a',
    plan: 'plus',
    limit_reached: false,
    windows: [
      { id: 'five_hour', used_percent: 66, reset_at: 1793032259 },
      { id: 'weekly', used_percent: 16.4, reset_at: null },
    ],
    fetched_at: 1793014259,
    next_refresh_at: 1793014559,
    stale: false,
    error: null,
  },
}

describe('parseAccountQuota', () => {
  it('turns used into left', () => {
    expect(parseAccountQuota(reply)).toEqual({
      group: 'team_a',
      plan: 'plus',
      windows: [
        { id: 'five_hour', left: 34, resetAt: 1793032259 },
        { id: 'weekly', left: 83.6, resetAt: null },
      ],
      resets: null,
      fetchedAt: 1793014259,
      nextRefreshAt: 1793014559,
      stale: false,
      error: false,
    })
  })

  it('shows nothing without an account or for a malformed reply', () => {
    expect(parseAccountQuota({ account: null })).toBeNull()
    expect(parseAccountQuota(null)).toBeNull()
    expect(parseAccountQuota('<html>')).toBeNull()
    expect(parseAccountQuota({ account: { group: '' } })).toBeNull()
  })

  it('drops unknown windows, clamps and flags an empty read', () => {
    const parsed = parseAccountQuota({
      account: {
        group: 'g',
        windows: [
          { id: 'daily', used_percent: 10 },
          { id: 'weekly', used_percent: 130 },
          { id: 'five_hour', used_percent: 'x' },
        ],
      },
    })
    expect(parsed?.windows).toEqual([{ id: 'weekly', left: 0, resetAt: null }])
    expect(parsed?.error).toBe(false)
    expect(
      parseAccountQuota({ account: { group: 'g', windows: [] } })?.error
    ).toBe(true)
  })
})

describe('planLabel and resetTime', () => {
  it('names the plans', () => {
    expect(planLabel('plus')).toBe('ChatGPT Plus')
    expect(planLabel('prolite')).toBe('ChatGPT Pro Lite')
    expect(planLabel('k12')).toBe('ChatGPT k12')
    expect(planLabel(null)).toBeNull()
  })

  it('says today for a reset later today, else the date', () => {
    const now = new Date(2026, 9, 26, 10, 0)
    const at = (d: Date) => Math.floor(d.getTime() / 1000)
    expect(
      resetTime(at(new Date(2026, 9, 26, 13, 14)), now, 'en-US', 'Today')
    ).toBe('Today 13:14')
    const later = resetTime(
      at(new Date(2026, 10, 1, 14, 22)),
      now,
      'en-US',
      'Today'
    )
    expect(later).toContain('Nov')
    expect(later).toContain('14:22')
  })
})

describe('reset cards', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the cards, soonest expiry first, and keeps an unknown usable count', () => {
    const parsed = parseAccountQuota({
      account: {
        ...reply.account,
        resets: { available: 2, usable: 0, expires_at: [300, 'x', 100] },
      },
    })
    expect(parsed?.resets).toEqual({
      available: 2,
      usable: 0,
      expiresAt: [100, 300],
    })
    expect(
      parseAccountQuota({
        account: { ...reply.account, resets: { available: 1, usable: null } },
      })?.resets
    ).toEqual({ available: 1, usable: null, expiresAt: [] })
    expect(
      parseAccountQuota({
        account: { ...reply.account, resets: { usable: 1 } },
      })?.resets
    ).toBeNull()
  })

  it('bands what is left', () => {
    expect([100, 70, 69, 30, 29, 0].map(quotaLevel)).toEqual([
      'good',
      'good',
      'warn',
      'warn',
      'bad',
      'bad',
    ])
  })

  it('treats an unexpected reset reply as unknown', () => {
    expect(
      parseResetReply({ result: 'reset', account: reply.account })
    ).toEqual({ result: 'reset', quota: parseAccountQuota(reply) })
    expect(parseResetReply({ result: 'maybe', account: null })).toEqual({
      result: 'unknown',
      quota: null,
    })
    expect(parseResetReply('<html>').result).toBe('unknown')
  })

  it('makes a v4 UUID even where randomUUID is missing (plain http)', () => {
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    expect(newRequestId()).toMatch(uuid)
    vi.stubGlobal('crypto', {
      getRandomValues: (b: Uint8Array) => b.fill(255),
    })
    expect(newRequestId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
  })

  it('labels the time zone and counts whole days down', () => {
    expect([480, 330, 0, -300].map(gmtLabel)).toEqual([
      'GMT+8',
      'GMT+5:30',
      'GMT',
      'GMT-5',
    ])
    const now = new Date(2026, 9, 27, 9, 30)
    const at = (d: Date) => Math.floor(d.getTime() / 1000)
    expect(resetExpiry(at(new Date(2026, 9, 30, 1, 24)), now, 'zh-CN')).toBe(
      '10/30 01:24 · 2天后'
    )
    expect(resetExpiry(at(new Date(2026, 10, 7, 7, 18)), now, 'zh-CN')).toBe(
      '11/07 07:18 · 10天后'
    )
    expect(resetExpiry(at(new Date(2026, 9, 27, 14, 0)), now, 'en')).toMatch(
      / · in 4 hours$/
    )
    expect(resetExpiry(at(now) + 20, now, 'en')).toMatch(/ · in 1 minute$/)
  })
})
