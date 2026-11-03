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
// The first screen's picture in plain numbers: no DOM, no GL, so it can be
// tested. Lengths on screen are in half-heights of the frame (see frameSize).
// engine.ts draws from these; the picked preview page used the same
// picture, and `?shot=wide` / `?shot=phone` there makes the posters
// (2400x1000, 390x844 at 2x), so change them together.

export const FOCAL = 3.15
/** The camera's distance from the hole (Schwarzschild radii): about 65 AU */
export const CAM_D = 33
/** The frame always holds this much width: wider windows see more sky */
export const FRAME_ASPECT = 1.778
/** Where the hole and the Earth sit, from the middle of the screen */
export const HOLE = { x: 0.2, y: -0.19 }
export const EARTH = { x: -1.19, y: -0.67, r: 0.17 }
/** The Earth's face (lat, lon, roll in degrees): China and its neighbours */
export const EARTH_LOOK = [26, 108, 18] as const
/** The most device pixels the canvas gets, per CSS pixel and across */
export const MAX_DPR = 1.5
export const MAX_WIDTH = 2560
/** The pointer's Einstein radius (CSS px) */
export const POINTER_LENS = 24

/** The frame's half-height (in px of the same unit as w, h) */
export const frameScale = (w: number, h: number) =>
  Math.min(h, w / FRAME_ASPECT) / 2

/** The canvas's size in device pixels for a box w x h (CSS px) at this quality */
export function canvasSize(
  w: number,
  h: number,
  dpr: number,
  quality = 1
): [number, number] {
  const k = Math.min(
    Math.min(dpr, MAX_DPR) * quality,
    MAX_WIDTH / Math.max(w, 1)
  )
  return [Math.max(16, Math.round(w * k)), Math.max(16, Math.round(h * k))]
}

/**
 * How much of the pointer's gravity applies at (x, y) in a box w x h (same
 * unit, from its top left): 1 over the hole and its disk, fading to 0 just
 * outside, 0 everywhere else.
 */
export function gravityAt(x: number, y: number, w: number, h: number): number {
  const s = frameScale(w, h)
  const dx = (x - w / 2) / s - HOLE.x
  const dy = (h / 2 - y) / s - HOLE.y
  // the disk's ellipse, turned with the picture
  const c = Math.cos(0.157)
  const si = Math.sin(0.157)
  const a = (c * dx + si * dy) / 1.3
  const b = (-si * dx + c * dy) / 0.62
  const d = Math.sqrt(a * a + b * b)
  return 1 - Math.min(1, Math.max(0, (d - 0.95) / 0.2))
}

/** The Earth's box in device pixels (x0, y0, x1, y1, from the bottom left) in a canvas w x h */
export function earthBox(
  w: number,
  h: number
): [number, number, number, number] {
  const s = frameScale(w, h)
  const cx = w / 2 + EARTH.x * s
  const cy = h / 2 + EARTH.y * s
  const r = EARTH.r * 1.16 * s
  return [
    Math.max(0, Math.floor(cx - r)),
    Math.max(0, Math.floor(cy - r)),
    Math.min(w, Math.ceil(cx + r)),
    Math.min(h, Math.ceil(cy + r)),
  ]
}

/**
 * Keeps an eye on the frames. Too many late ones in a window of 60 lowers the
 * quality, one step at a time. New shaders run slow for their first seconds on
 * any GPU, so a long calm tries a step back up (twice at most), and only frames
 * still late at the lowest quality once those seconds have passed give up on motion.
 */
export type Pace = {
  budget: number
  late: number
  frames: number
  /** ms of frames seen */
  elapsed: number
  /** windows without trouble, in a row */
  calm: number
  /** steps back up tried so far */
  raises: number
}
export const newPace = (vsync: number): Pace => ({
  budget: Math.max(vsync, 15.5),
  late: 0,
  frames: 0,
  elapsed: 0,
  calm: 0,
  raises: 0,
})
const WARM_MS = 20_000
const CALM_WINDOWS = 20
const MAX_RAISES = 2
export const QUALITY_STEP = 0.75
export const QUALITY_MIN = 0.56
export function paceFrame(
  pace: Pace,
  gap: number,
  quality: number
): 'keep' | 'lower' | 'raise' | 'freeze' {
  pace.frames++
  pace.elapsed += gap
  if (gap > pace.budget * 1.55) pace.late++
  if (pace.frames < 60) return 'keep'
  const late = pace.late
  pace.frames = 0
  pace.late = 0
  if (late < 20) {
    pace.calm++
    if (quality >= 1 || pace.calm < CALM_WINDOWS || pace.raises >= MAX_RAISES) {
      return 'keep'
    }
    pace.calm = 0
    pace.raises++
    return 'raise'
  }
  pace.calm = 0
  if (quality > QUALITY_MIN) return 'lower'
  return late >= 40 && pace.elapsed >= WARM_MS ? 'freeze' : 'keep'
}

/**
 * Off the hole, about 60 frames a second are enough. A screen only offers whole
 * refreshes, so the frame goes on the refresh nearest 1/60 s after the last one:
 * a fixed wait would halve 75 Hz to 37 fps, and paceFrame would read those gaps as
 * a slow machine. A shade under half a refresh keeps 90 Hz from sitting on the
 * fence between every refresh and every other one.
 */
export const frameDue = (sinceLastFrame: number, refresh: number): boolean =>
  sinceLastFrame >= 1000 / 60 - refresh * 0.55
