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
import { useEffect, useSyncExternalStore } from 'react'

import { cachedImageUrl, loadImageUrl, subscribeImageUrls } from '../lib/images'

/** Object URL of a stored picture; undefined until it has loaded. */
export function useImageUrl(
  id: string | undefined,
  variant: 'full' | 'thumb' = 'thumb'
): string | undefined {
  const url = useSyncExternalStore(subscribeImageUrls, () =>
    id ? cachedImageUrl(id, variant) : null
  )
  useEffect(() => {
    if (id && !url) void loadImageUrl(id, variant)
  }, [id, variant, url])
  return url ?? undefined
}
