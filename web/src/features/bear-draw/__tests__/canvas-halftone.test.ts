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
import { afterEach, describe, expect, test } from 'vitest'

import { halftoneClock, halftonePhase, mountHalftone } from '../lib/halftone'

// Sunburst: p50 25 s, p90 40 s; edits p50 34.5 s, p90 64 s.
const MODEL = 'gpt-image-2.5-sunburst'

describe('halftonePhase (the status word)', () => {
  test('the first seconds say it is starting', () => {
    expect(halftonePhase(3, MODEL)).toBe('start')
  })

  test('until p50 + 5 s it adds details', () => {
    expect(halftonePhase(29, MODEL)).toBe('details')
  })

  test('after that it is finishing', () => {
    expect(halftonePhase(31, MODEL)).toBe('finish')
  })

  test('past 1.5 × p90 it says it is slower than usual', () => {
    expect(halftonePhase(61, MODEL)).toBe('slow')
  })

  test('an edit uses the slower edit times', () => {
    expect(halftonePhase(61, MODEL, true)).toBe('finish')
  })

  test('an unknown model uses the default times', () => {
    expect(halftonePhase(29, 'some-new-model')).toBe('details')
    expect(halftonePhase(61, 'some-new-model')).toBe('slow')
  })
})

describe('halftoneClock', () => {
  test('shows minutes and two-digit seconds', () => {
    expect(halftoneClock(0)).toBe('0:00')
    expect(halftoneClock(75.9)).toBe('1:15')
  })
})

describe('mountHalftone', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  const status = (host: HTMLElement) => ({
    word: host.querySelector('.bd-ht-w')?.textContent,
    clock: host.querySelector('.bd-ht-t')?.textContent,
  })

  test('a queued picture says Queued and shows no clock', () => {
    const host = document.createElement('div')
    const ht = mountHalftone(host, { model: MODEL, queued: true })
    expect(status(host)).toEqual({ word: 'Queued', clock: '' })
    ht.destroy()
  })

  test('once started it shows the phase and the time so far', () => {
    const host = document.createElement('div')
    const ht = mountHalftone(host, { model: MODEL, queued: true })
    ht.setStarted(Date.now() - 20_000)
    expect(status(host)).toEqual({ word: 'Adding details', clock: '0:20' })
    ht.destroy()
  })

  test('destroy removes the dot screen', () => {
    const host = document.createElement('div')
    mountHalftone(host, { startedAt: Date.now() }).destroy()
    expect(host.childElementCount).toBe(0)
  })

  test('reveal (reduced motion) leaves the picture to the caller', async () => {
    const host = document.createElement('div')
    const ht = mountHalftone(host, { startedAt: Date.now() })
    await ht.reveal(new Image())
    expect(host.querySelector('.bd-ht')).toBeNull()
  })
})
