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
import { useCallback, useEffect, useRef, useState } from 'react'

import { probeApiAddress, type ApiAddressProbe } from '../lib/api-address-probe'

/**
 * Latency probes for a list of API addresses, started on demand. A new start
 * cancels the probes still running; unmounting cancels them too.
 */
export function useApiAddressProbes(urls: string[]) {
  const [probes, setProbes] = useState<Record<string, ApiAddressProbe>>({})
  const controllerRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  const start = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setProbes(
      Object.fromEntries(
        urls.map((url): [string, ApiAddressProbe] => [
          url,
          { state: 'checking' },
        ])
      )
    )
    for (const url of urls) {
      void probeApiAddress(url, controller.signal).then((result) => {
        if (controller.signal.aborted) return
        setProbes((current) => ({ ...current, [url]: result }))
      })
    }
  }, [urls])

  useEffect(() => stop, [stop])

  return { probes, start, stop }
}
