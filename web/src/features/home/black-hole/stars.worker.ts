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
// Builds the star lists off the main thread (see stars.ts). The page fetches
// the pack (so the HTML's preload of it is used) and hands it over.
import { type StarLook, buildStars, gunzipped, unpackStars } from './stars'

type Job = { pack: ArrayBuffer; look: StarLook }

self.addEventListener('message', async (e: MessageEvent<Job>) => {
  const { pack, look } = e.data
  try {
    const out = buildStars(unpackStars(await gunzipped(pack)), look)
    ;(self as unknown as Worker).postMessage(out, [
      out.index.buffer,
      out.list.buffer,
    ])
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ error: String(err) })
  }
})
