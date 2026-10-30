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
import { lazy, memo, Suspense } from 'react'

import { resolveModelProvider } from '@/lib/model-provider'

/*
 * The model makers' logos (OpenAI, Claude, Gemini…) come from the icon set
 * behind lib/lobe-icon, whose index alone is ~45 KB compressed: the drawing
 * page loads it after its first paint. The box keeps its size meanwhile, so
 * nothing moves when the logo arrives. Same rules as the chat page's icon.
 */
const LobeIcon = lazy(() =>
  import('@/lib/lobe-icon').then((m) => ({
    default: (props: { name: string; size: number }) =>
      m.getLobeIcon(props.name, props.size),
  }))
)

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
      <Suspense fallback={null}>
        <LobeIcon name={provider.icon} size={size} />
      </Suspense>
    </span>
  )
})
