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
import { useTranslation } from 'react-i18next'

import type { ApiAddressProbe } from '../lib/api-address-probe'

/**
 * One sentence for screen readers once every address has been tested: the
 * dots and numbers change silently. Empty while testing, and when `announce`
 * is off (a test the page started by itself, not one the user asked for).
 */
export function ProbeSummary(props: {
  probes: Record<string, ApiAddressProbe>
  announce: boolean
}) {
  const { t } = useTranslation()
  const results = Object.values(props.probes)
  const done =
    results.length > 0 && results.every((probe) => probe.state !== 'checking')
  let message = ''
  if (props.announce && done) {
    const latencies = results.flatMap((probe) =>
      probe.state === 'reachable' ? [probe.latency] : []
    )
    message = latencies.length
      ? t('Latency test done. Fastest: {{latency}} ms', {
          latency: Math.min(...latencies),
        })
      : t('Latency test done. No address can be reached')
  }
  return (
    <p role='status' className='sr-only'>
      {message}
    </p>
  )
}
