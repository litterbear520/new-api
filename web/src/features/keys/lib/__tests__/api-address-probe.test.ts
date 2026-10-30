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
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  getApiAddressGrade,
  getApiAddressProbeEndpoint,
  probeApiAddress,
} from '../api-address-probe'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('getApiAddressGrade', () => {
  test('grades by absolute latency', () => {
    expect(getApiAddressGrade(1)).toBe('excellent')
    expect(getApiAddressGrade(299)).toBe('excellent')
    expect(getApiAddressGrade(300)).toBe('good')
    expect(getApiAddressGrade(799)).toBe('good')
    expect(getApiAddressGrade(800)).toBe('slow')
  })
})

describe('getApiAddressProbeEndpoint', () => {
  test('targets /v1/models under the configured address', () => {
    expect(getApiAddressProbeEndpoint('https://api.example.com')).toBe(
      'https://api.example.com/v1/models'
    )
    expect(getApiAddressProbeEndpoint(' https://api.example.com/ ')).toBe(
      'https://api.example.com/v1/models'
    )
    expect(getApiAddressProbeEndpoint('https://gw.example.com/proxy/v1/')).toBe(
      'https://gw.example.com/proxy/v1/models'
    )
  })
})

describe('probeApiAddress', () => {
  test('reports the faster of the cold and warm request', async () => {
    const times = [0, 900, 1000, 1120]
    vi.spyOn(performance, 'now').mockImplementation(() => times.shift() ?? 0)
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { message: 'Invalid token' } }), {
          status: 401,
        })
    )

    await expect(probeApiAddress('https://api.example.com')).resolves.toEqual({
      state: 'reachable',
      latency: 120,
      grade: 'excellent',
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  test('treats a non-JSON answer, such as a block page, as unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('<html>blocked</html>', { status: 200 })
    )

    await expect(probeApiAddress('https://api.example.com')).resolves.toEqual({
      state: 'unreachable',
    })
  })

  test('gives up after the timeout', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
        })
    )

    const result = probeApiAddress('https://slow.example.com')
    await vi.advanceTimersByTimeAsync(5000)
    await expect(result).resolves.toEqual({ state: 'unreachable' })
  })
})
