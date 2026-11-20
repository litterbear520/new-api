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

/** How long a hidden tab (no animation frames) waits before committing. */
const HIDDEN_WAIT = 250

/**
 * Runs `commit` at most once per animation frame, however often `request`
 * is called in between. A hidden tab runs no frames, so a timer stands in;
 * `flush` commits what is waiting right away (the stream ended).
 */
export function frameBatch(commit: () => void) {
  let frame: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    if (frame == null && timer == null) return
    if (frame != null) cancelAnimationFrame(frame)
    if (timer != null) clearTimeout(timer)
    frame = null
    timer = null
    commit()
  }

  function request() {
    if (frame != null || timer != null) return
    frame = requestAnimationFrame(flush)
    timer = setTimeout(flush, HIDDEN_WAIT)
  }

  return { request, flush }
}
