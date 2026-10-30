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
// What the black hole draws from.
import { preload } from 'react-dom'

import landUrl from './tex/earth-land.jpg'
import lightsUrl from './tex/earth-lights.webp'
import moonUrl from './tex/earth-moon.webp'
import milkyUrl from './tex/milkyway-2k.webp'

export const BLACK_HOLE_ASSETS = {
  /** NASA Earth Observatory, Black Marble 2016: city lights over East Asia, moonlit land, the coarse globe */
  lights: lightsUrl,
  moon: moonUrl,
  land: landUrl,
  /**
   * NASA/Goddard SVS Deep Star Maps 2020 (Gaia DR2: ESA/Gaia/DPAC), the whole
   * sky 2048 px wide (the night sea's band is soft: a sharper map would not
   * show). Baked (the prototype's tools/mw_bake.py): light on a log scale
   * times colour, denoised.
   */
  milky: milkyUrl,
  /** Hipparcos-2 stars brighter than 9th magnitude, packed (gzip) */
  stars: new URL('./tex/stars.pack', import.meta.url).href,
}
export type BlackHoleAssets = typeof BLACK_HOLE_ASSETS

/**
 * Starts the first pictures and the stars downloading while the engine's own
 * chunk loads, after the page's words are up (they come first: the words are
 * what the page is first measured by).
 */
export function preloadSky() {
  const low = { fetchPriority: 'low' } as const
  for (const href of [
    BLACK_HOLE_ASSETS.lights,
    BLACK_HOLE_ASSETS.moon,
    BLACK_HOLE_ASSETS.land,
    BLACK_HOLE_ASSETS.milky,
  ]) {
    preload(href, { as: 'image', ...low })
  }
  // fetch() asks with CORS, same origin: the preload must too, or it is fetched twice
  preload(BLACK_HOLE_ASSETS.stars, {
    as: 'fetch',
    crossOrigin: 'anonymous',
    ...low,
  })
}
