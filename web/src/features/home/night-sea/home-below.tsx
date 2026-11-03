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
// Everything under the first screen, its own chunk: NightSeaHome brings it in
// when it is wanted (below-fold.ts).
import type { ComponentProps } from 'react'

import { Gateway } from '../black-hole/gateway'
import { HomeEnd, HomeSections } from './sections'

export function BelowSections(props: ComponentProps<typeof HomeSections>) {
  return <HomeSections {...props} gateway={<Gateway />} />
}

export { HomeEnd }
