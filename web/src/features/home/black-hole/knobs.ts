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
// The black hole home's knobs: pure numbers, no DOM or GL, so they can be
// tested. engine.ts draws from them.

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const ease = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
export const smooth = (a: number, b: number, x: number) =>
  ease((x - a) / (b - a))

/**
 * The look (prototype round 7): the first screen's still camera. Shares of
 * the screen are shares of the frame it is set in (lookFrame, FRAME wide),
 * which a screen of another shape shows a crop of.
 */
export const KNOBS = {
  // the Earth camera on the first screen
  fov: 60, // horizontal field of view (deg)
  alt: 3000, // km
  lat: 30, // the point below the camera
  lon: 104,
  hdg: 78, // which way it looks (deg from north)
  limb: 0.69, // the limb's height in the middle of the frame (share of the height from the top), before the roll
  roll: 9, // deg
  // the hole on the first screen
  hx: 0.67, // its centre (share of the frame's width / height from the top left)
  hy: 0.47,
  hr: 0.055, // its shadow's radius (share of the frame's width)
  hroll: 12, // deg the image turns
  hel: 3.6, // the camera's height above the disk plane (deg); the film's was 3.4
  // the disk
  dl: 2.1, // its light
  gd: 0.4, // optical depth
  gi: 3.5, // brighter towards the inner edge
  gw: 0.7, // torn wisps past the edge
  ge: 1, // how ragged the edge is
  gf: 0.8, // flow speed
  rin: 2, // inner edge (Schwarzschild radii; the film's hole spins, so its disk reaches in further)
  rout: 8, // outer edge
  rw: 11, // the wisps end
  bsw: 2, // streaks: how much they wander
  blen: 0.6, // how long they run round the disk
  btear: 0.8, // how torn the gas is
  bcon: 2, // contrast
  dg: 0.12, // dusty glow round the outer disk
  dh: 0.035, // its thickness (share of the radius)
  // the sky turned so galactic longitude gl (Aquila) is behind the hole on the first screen, gb deg off
  // the plane, the band (towards higher l) at ga deg up from the right: it rises from behind the Earth
  // between the words and the hole, as the night sea's rises from the sea behind the boat, its dark
  // rift up the middle
  gl: 30,
  gb: 12,
  ga: 65,
  night: 1, // the dark between the stars
  nr: 4, // its colour (display, 0..255): the night sea's
  ng: 6,
  nb: 13,
  // the night sea's glow low in the sky (display, 0..255, and its opacity), from gy0 (none) to gy1
  // (full) of the screen from the top; it goes as the Earth sinks
  nhr: 58,
  nhg: 76,
  nhb: 110,
  nha: 0.42,
  gy0: 0.34,
  gy1: 0.74,
  mw: 0.18, // the Milky Way where it is brightest (HDR)
  mwbp: 0.0025, // the map's sky glow, taken off (its black point, light per pixel of NASA's 16k map)
  mwmax: 0.04, // its brightest
  mwg: 1.2, // its curve between (log scale, then this power)
  mwst: 2.5, // softer where the hole stretches it (stretch ^ this): smooth arcs, not hairs
  mwsat: 0.1, // how much of the map's own colour (its dust) shows
  mwsoft: 4, // it is read this much softer: the night sea's haze, not the map's grain
  mwsp: 0.9, // its deep stars shown before you look (where it is bright; the night sea's band is full of them)
  mwfr: 180, // its colour where faint (0..255 of the light; the night sea's band is 196 207 238)
  mwfg: 200,
  mwfb: 255,
  dfr: 0, // the deep field before you look (where you look: all of it)
  sg: 1, // the catalogue's stars, as the night sea's dots (stars.ts)
  smax: 7.6, // the faintest of them that show before you look (mag, on a 1440 px screen)
  sa: 1.2, // their opacity, times the night sea's
  sz: 1.25, // their size, times the night sea's
  sd: 1, // the deep ones
  tw: 0.5, // twinkle
  smag: 1.2, // the most the hole may brighten a star
  // the pointer, as on the night sea: where you look the sky shows more, under a soft light
  rest: 0.5, // how much of the faint sky shows before you look at it
  lens: 190, // the reveal's radius (CSS px)
  spot: 340, // the soft light's radius (CSS px)
  trail: 1.6, // seconds a looked-at patch stays
  fl: 0.25, // near the hole the sky behind it follows the pointer this far (Einstein radii)
  fr0: 0.6, // the sky moves fully inside this many Einstein radii, not at all outside fr1
  fr1: 1.4,
  fp0: 0.6, // the pointer stirs it fully within this many Einstein radii of the hole, not at all past fp1
  fp1: 1.8,
  // the Earth and its air
  sun: 1,
  city: 1.4,
  glint: 1.6,
  em: 2,
  el: 1,
  eo: 1,
  er: 0.5,
  ea: 0.09,
  ez: 0.5,
  hs: 0.0095,
  rf: 0.12,
  mie: 1.5,
  // grade
  ex: 1,
  bl: 0.17,
  bw: 1,
  thr: 0.5,
  hal: 1,
  sat: 0.85,
  gr: 0.008, // film grain (the dither is separate)
  con: 1,
  vig: 0.25,
  wp: 1,
  lift: 0.4,
  dpr: 2, // the most device pixels per CSS pixel the canvas gets
}
export type Knobs = typeof KNOBS

/**
 * The frame the look is set in (width / height): the knobs' shares are of it,
 * and the poster under the canvas is drawn in it. A wider or taller screen
 * shows a crop of it round the hole, as CSS object-fit: cover with
 * object-position (hx, hy) crops the poster (black-hole.css), so the two meet
 * exactly. Screens near square or taller (a tablet held upright) keep their
 * own frame.
 */
export const FRAME = 1.9
const OWN_FRAME_BELOW = 1.2
/** The same, as the CSS asks it (the window's shape, scroll bar and all) */
export const OWN_FRAME_QUERY = '(max-aspect-ratio: 6/5)'

/**
 * The frame for a canvas w x h (any unit), and where the canvas sits in it:
 * x from its left, y from its bottom. `own`: the canvas keeps its own frame
 * (the engine asks OWN_FRAME_QUERY, as the poster's CSS does)
 */
export function lookFrame(
  w: number,
  h: number,
  hx: number,
  hy: number,
  own = w / h < OWN_FRAME_BELOW
): { w: number; h: number; x: number; y: number } {
  if (own) return { w, h, x: 0, y: 0 }
  const fw = Math.max(w, h * FRAME)
  const fh = Math.max(h, w / FRAME)
  return { w: fw, h: fh, x: hx * (fw - w), y: (1 - hy) * (fh - h) }
}

/** Phones: the hole under the words, closer (the still picture for phones is drawn with these) */
export const PHONE_KNOBS: Partial<Knobs> = {
  fov: 40,
  limb: 0.8,
  hx: 0.6,
  hy: 0.67,
  hr: 0.085,
  lens: 130,
  spot: 220,
}

/** A screen as narrow as a phone's gets the phone's framing (support.ts PHONE_QUERY) */
export const isPhone = (w: number) => w <= 640

export function knobsFor(phone: boolean, reduced: boolean): Knobs {
  const k = { ...KNOBS, ...(phone ? PHONE_KNOBS : {}) }
  // less motion asked for: the disk holds still, no twinkle, the sky doesn't flow
  if (reduced) Object.assign(k, { tw: 0, fl: 0 })
  return k
}

/** The bar over the page (CSS px, at most) and the clear sky kept under it */
export const BAR = 64
export const BAR_GAP = 16
/** How far the hole's light reaches above its centre (shadow radii): the arc */
export const REACH_UP = 2.15

/** The shadow's radius (rad) seen from d Schwarzschild radii */
const shadowAngle = (d: number) => Math.asin((2.598 / d) * Math.sqrt(1 - 1 / d))

/** Distance (Schwarzschild radii) at which the shadow's radius looks `ang` rad */
export function holeDistance(ang: number): number {
  const s = Math.sin(ang)
  let lo = 2
  let hi = 1e4
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2
    if ((2.598 / m) * Math.sqrt(1 - 1 / m) > s) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

/** The shadow's radius on the hole camera's image plane (focal length `focal`) */
export const shadowAt = (d: number, focal: number) =>
  focal * Math.tan(shadowAngle(d))
