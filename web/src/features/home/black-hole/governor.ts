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
// How many pixels the black hole draws, by whether its frames keep the
// screen's pace (engine.ts). The screen's own pace is learnt from frames
// that ask nothing of the GPU (while the sky loads, and those the engine
// skips): the first dozen say what it is (a browser saving power may hold
// it to 30 a second), later ones can only make it quicker. A frame is late
// when it comes more than half a frame after its time (and a quarter of the
// screen's frame, so wobbling timestamps don't decide). Late frames in more
// than a few of every hundred, for a second and a half, and the sky draws
// fewer pixels, down to 61% of the resolution; if even that can't keep up,
// the still picture. New shaders run at about half speed for their first
// seconds to a minute, until the driver has compiled them better in the
// background: for the first 20 s only frames over 30 ms count (on a 60 Hz
// screen any missed frame is, so a weak GPU there steps down at once), and
// once frames keep time for a while there are more pixels again, so that
// start doesn't leave the sky soft for good.

/** Each step down keeps this share of the pixels across (and up) */
const STEP = 0.85
/** No step down from here (three steps: 61%) */
const LEAST = 0.62
/** The share of late frames, over WINDOW ms, that is too many */
const TOO_LATE = 0.05
const WINDOW = 1500
const GRACE = 20000
/** Frames this far apart (ms) are a pause (the page out of sight), not a frame */
const PAUSE = 250
/** After a pause or a change of resolution, frames settle for this long (ms) before they count */
const SETTLE = 500

export type Governor = {
  /** The share of the screen's resolution to draw at */
  readonly res: number
  /** How long (ms) a frame has: the screen's interval, as often as the engine draws (at most every `minGap` ms) */
  readonly budget: number
  /** A frame of the screen's came `ms` after the one before, nothing drawn in it: its pace */
  screen: (ms: number) => void
  /** A frame was drawn `ms` after the one before, at `now` (ms): what to do */
  frame: (ms: number, now: number) => 'down' | 'up' | 'fail' | null
  /** Frames start again at `now` (ms) after a pause or a new size: count afresh */
  resume: (now: number) => void
}

export function governor(minGap = 0): Governor {
  let res = 1
  /** The screen's interval (ms): the first steady one seen, then the shortest */
  let vsync = 16.7
  let learnt = false
  const paces: number[] = []
  let windowAt = -1
  let countFrom = 0
  let frames = 0
  let late = 0
  /** Since when frames have kept time (while drawing fewer pixels) */
  let calmSince = -1
  /** How long frames must keep time before going up (doubled when going up was too much) */
  let patience = 3000
  let raisedAt = -Infinity
  let born = -1
  let hopeless = 0
  // the engine draws on the first of the screen's frames at least minGap after its last
  const budget = () => vsync * Math.max(1, Math.ceil(minGap / vsync))
  const newWindow = (now: number) => {
    windowAt = now
    frames = 0
    late = 0
  }
  /** After a pause or a change of resolution: count afresh */
  const restart = (now: number) => {
    newWindow(now)
    calmSince = now
    countFrom = now + SETTLE
  }
  return {
    get res() {
      return res
    },
    get budget() {
      return budget()
    },
    screen(ms) {
      if (!(ms > 3 && ms < 60)) return
      paces.push(ms)
      if (paces.length < 12) return
      // the median of a dozen, if nearly all agree: ticks held up by the page's
      // own work (while the sky loads) say nothing about the screen
      const sorted = [...paces].sort((a, b) => a - b)
      paces.length = 0
      const m = sorted[6]
      if (sorted[1] < m - 1.5 || sorted[10] > m + 1.5) return
      vsync = learnt ? Math.min(vsync, m) : m
      learnt = true
    },
    frame(ms, now) {
      if (ms > PAUSE) {
        restart(now)
        return null
      }
      if (born < 0) {
        born = now
        restart(now)
      }
      if (now < countFrom) {
        newWindow(now)
        return null
      }
      const due = budget()
      const slowAt = Math.max(
        1.5 * due + 0.25 * vsync,
        now - born < GRACE ? 30 : 0
      )
      const isLate = ms > slowAt
      frames++
      if (isLate) {
        late++
        calmSince = now
      }
      hopeless = res <= LEAST && ms > 45 ? hopeless + ms : 0
      if (hopeless > 3000) return 'fail'
      if (res < 1 && now - calmSince > patience) {
        res = Math.min(1, res / STEP)
        raisedAt = now
        restart(now)
        return 'up'
      }
      if (now - windowAt < WINDOW) return null
      const tooLate = late > frames * TOO_LATE
      newWindow(now)
      if (!tooLate || res <= LEAST) return null
      if (now - raisedAt < 8000) patience *= 2
      res *= STEP
      restart(now)
      return 'down'
    },
    resume: restart,
  }
}
