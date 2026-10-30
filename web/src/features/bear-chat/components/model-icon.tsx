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
import { memo } from 'react'

import { getLobeIcon } from '@/lib/lobe-icon'
import { resolveModelProvider } from '@/lib/model-provider'

/**
 * The maker's logo for a model id (OpenAI, Claude, Gemini…), using the same
 * rules as the usage logs. Unknown models get no icon rather than a letter.
 */
export const ModelIcon = memo(function ModelIcon(props: {
  model: string
  size?: number
}) {
  const provider = props.model ? resolveModelProvider(props.model) : null
  if (!provider?.icon) return null
  const size = props.size ?? 14
  return (
    <span
      className='bc-micon'
      style={{ width: size, height: size }}
      aria-hidden='true'
    >
      {getLobeIcon(provider.icon, size)}
    </span>
  )
})
