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
// The black hole's pictures: fetched once the first screen's words have shown,
// so they take nothing from those (night-sea-home.tsx preloadSky).
import { preload } from 'react-dom'

import earthUrl from './tex/earth-city.webp'
import milkyUrl from './tex/milkyway-2k.webp'

export const BLACK_HOLE_ASSETS = {
  /** NASA Earth Observatory, Black Marble 2016: the night Earth's lights, the whole globe */
  earth: earthUrl,
  /** NASA/Goddard SVS Deep Star Maps 2020 (Gaia DR2: ESA/Gaia/DPAC), the whole sky in J2000 */
  milky: milkyUrl,
}
export type BlackHoleAssets = typeof BLACK_HOLE_ASSETS

export function preloadSky() {
  for (const href of [BLACK_HOLE_ASSETS.earth, BLACK_HOLE_ASSETS.milky]) {
    preload(href, { as: 'image', fetchPriority: 'low' })
  }
}
