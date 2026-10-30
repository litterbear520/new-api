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

import { runStart } from '../components/parts/format'
import type { ProgressItem } from '../types'

const T0 = 1_000_000

const pic = (id: string, patch: Partial<ProgressItem>): ProgressItem => ({
  id,
  nodeId: `n-${id}`,
  label: id,
  model: 'gpt-image-2.5-sunburst',
  prompt: 'A navy thermos',
  status: 'queued',
  ...patch,
})

describe('set clock', () => {
  it('counts from the first picture of a run, through pictures that finished meanwhile', () => {
    const items = [
      pic('a', { status: 'done', startedAt: T0, secs: 20 }),
      pic('b', { status: 'done', startedAt: T0, secs: 24 }),
      // started when "a" finished, still drawing
      pic('c', { status: 'drawing', startedAt: T0 + 20_000 }),
      pic('d', { status: 'drawing', startedAt: T0 + 24_000 }),
    ]

    expect(runStart(items)).toBe(T0)
  })

  it('starts a fresh clock for a picture drawn again long after its set', () => {
    const items = [
      pic('a', { status: 'done', startedAt: T0, secs: 20 }),
      pic('b', { status: 'drawing', startedAt: T0 + 300_000 }),
    ]

    expect(runStart(items)).toBe(T0 + 300_000)
  })

  it('has no clock while every picture still waits for a slot', () => {
    expect(runStart([pic('a', {}), pic('b', {})])).toBeNull()
  })
})
