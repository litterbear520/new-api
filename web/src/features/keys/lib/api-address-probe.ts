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

export type ApiAddressGrade = 'excellent' | 'good' | 'slow'

export type ApiAddressProbe =
  | { state: 'checking' }
  | { state: 'reachable'; latency: number; grade: ApiAddressGrade }
  | { state: 'unreachable' }

export const API_ADDRESS_PROBE_TIMEOUT_MS = 5000

export function getApiAddressGrade(latency: number): ApiAddressGrade {
  if (latency < 300) return 'excellent'
  if (latency < 800) return 'good'
  return 'slow'
}

/**
 * New API answers an unauthenticated GET /v1/models with a JSON error and CORS
 * headers, so reading that JSON back proves the relay itself is reachable from
 * the visitor's network, not just that some server (or a block page) answered.
 */
export function getApiAddressProbeEndpoint(url: string): string {
  const base = url.trim().replace(/\/+$/, '')
  return base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`
}

async function requestOnce(
  endpoint: string,
  signal: AbortSignal
): Promise<number> {
  const start = performance.now()
  const response = await fetch(endpoint, {
    cache: 'no-store',
    credentials: 'omit',
    signal,
  })
  const body: unknown = await response.json()
  if (
    !body ||
    typeof body !== 'object' ||
    !('error' in body || 'data' in body)
  ) {
    throw new Error('Unexpected response')
  }
  return performance.now() - start
}

/**
 * Two requests in a row: the first also pays for DNS, TCP and TLS setup, the
 * second shows the round trip on a warm connection. The faster one is reported
 * so a single slow handshake does not hide an otherwise good address.
 */
export async function probeApiAddress(
  url: string,
  signal?: AbortSignal
): Promise<ApiAddressProbe> {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    API_ADDRESS_PROBE_TIMEOUT_MS
  )
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })

  try {
    const endpoint = getApiAddressProbeEndpoint(url)
    const first = await requestOnce(endpoint, controller.signal)
    const second = await requestOnce(endpoint, controller.signal).catch(
      () => first
    )
    const latency = Math.max(1, Math.round(Math.min(first, second)))
    return { state: 'reachable', latency, grade: getApiAddressGrade(latency) }
  } catch {
    return { state: 'unreachable' }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
