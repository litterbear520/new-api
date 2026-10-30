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
// Light round a still (Schwarzschild) hole, in its Schwarzschild radii. Along a ray, u = 1/r as a
// function of the angle phi it has turned round the hole obeys u'' = 1.5 u^2 - u (' = d/dphi), with
// (u')^2 + u^2 - u^3 = C fixed: every ray is one of a single family, labelled by b = 1/sqrt(C) (its
// impact parameter far away). So the hole is drawn from tables made once, not by stepping each ray
// (after Bruneton 2020, "Real-time high-quality rendering of non-rotating black holes"):
//   SWEEP (N1 x 2): how far a ray turns, from far away, in to its closest approach (row 1: rays that
//     get away) or in to r = R_END (row 0: rays the hole takes)
//   PATH (NC x 2 NR): u at even steps of that turn (0..1 of it), for the rays that can meet the disk;
//     rows 0..NR-1 taken, NR..2NR-1 away
// Rows are spaced by q = ln|b - BC| (BC = 3 sqrt(3) / 2: rays near it wind round the hole many times).
// Pure (no DOM, no GL): runs in a worker. The shader's half is in shaders.ts (trace).

export const BC = (3 * Math.sqrt(3)) / 2
export const Q0 = -16
/** q at b = 0 (the taken rays' last row) */
export const QC = Math.log(BC)
/** The sweep table's rays that get away reach b = 2000 */
export const QE1 = Math.log(2000 - BC)
/** The path table's reach b = 14.6: rays further out stay beyond the disk */
export const QE2 = Math.log(12)
export const N1 = 1024
export const NC = 512
export const NR = 512
/** A taken ray is followed in to here (the disk ends at r = 1.8) */
const U_END = 1 / 1.4

/** b of row i of n spaced over q0..q1, on the taken (away = false) or the other side of BC */
export function rowB(i: number, n: number, q1: number, away: boolean) {
  const d = Math.exp(Q0 + ((q1 - Q0) * i) / (n - 1))
  return away ? BC + d : Math.max(BC - d, 1e-4)
}

/**
 * One ray from far away: (phi, u, u') at small steps (RK4, at most .01 rad, changing u by at most .006),
 * in to its closest approach (away) or to U_END; the end found by bisection. `keep` = record the steps
 * (in PS, US, DS). Returns the number of steps kept and how far the ray turned.
 */
const MAXN = 60000
// the steps of the ray being followed (made by buildLens: a page that only reads camTable needs none)
let PS = new Float64Array(0)
let US = PS
let DS = PS
const out = { n: 0, end: 0 }
function follow(b: number, away: boolean, keep: boolean) {
  let p = 0,
    u = 0,
    d = 1 / b,
    n = 0
  if (keep) {
    PS[0] = 0
    US[0] = 0
    DS[0] = d
  }
  // tries a step of h from (u, d): the result in (tu, td); ends = it passes the end
  let tu = 0,
    td = 0
  const tryStep = (h: number) => {
    const k1d = 1.5 * u * u - u
    const a2 = u + 0.5 * h * d,
      k2u = d + 0.5 * h * k1d,
      k2d = 1.5 * a2 * a2 - a2
    const a3 = u + 0.5 * h * k2u,
      k3u = d + 0.5 * h * k2d,
      k3d = 1.5 * a3 * a3 - a3
    const a4 = u + h * k3u,
      k4u = d + h * k3d,
      k4d = 1.5 * a4 * a4 - a4
    tu = u + (h / 6) * (d + 2 * k2u + 2 * k3u + k4u)
    td = d + (h / 6) * (k1d + 2 * k2d + 2 * k3d + k4d)
    return away ? td <= 0 : tu >= U_END
  }
  // (a ray that never reached its end would be a bug: stop rather than spin)
  for (let steps = 0; steps < 400000 && n < MAXN - 2; steps++) {
    const ad = d < 0 ? -d : d
    const h = 0.006 < 0.01 * ad ? 0.006 / ad : 0.01
    if (tryStep(h)) {
      let lo = 0,
        hi = h
      for (let i = 0; i < 40; i++) {
        const m = 0.5 * (lo + hi)
        if (tryStep(m)) hi = m
        else lo = m
      }
      tryStep(hi)
      if (keep) {
        n++
        PS[n] = p + hi
        US[n] = away ? tu : U_END
        DS[n] = away ? 0 : td
      }
      out.n = n + 1
      out.end = p + hi
      return out
    }
    p += h
    u = tu
    d = td
    if (keep) {
      n++
      PS[n] = p
      US[n] = u
      DS[n] = d
    }
  }
  throw new Error('lens: a ray never ended')
}

/** Fills out[0..NC) with u at even steps of a followed ray's turn (cubic Hermite between its steps) */
function resample(
  r: { n: number; end: number },
  out: Float32Array,
  at: number
) {
  let j = 0
  for (let c = 0; c < NC; c++) {
    const phi = (r.end * c) / (NC - 1)
    while (j < r.n - 2 && PS[j + 1] < phi) j++
    const p0 = PS[j],
      h = PS[j + 1] - p0
    const t = Math.min(1, Math.max(0, (phi - p0) / h))
    const t2 = t * t,
      t3 = t2 * t
    out[at + c] =
      (2 * t3 - 3 * t2 + 1) * US[j] +
      (t3 - 2 * t2 + t) * h * DS[j] +
      (-2 * t3 + 3 * t2) * US[j + 1] +
      (t3 - t2) * h * DS[j + 1]
  }
}

export type LensTables = { sweep: Float32Array; path: Float32Array }

export function buildLens(): LensTables {
  PS = new Float64Array(MAXN)
  US = new Float64Array(MAXN)
  DS = new Float64Array(MAXN)
  const sweep = new Float32Array(N1 * 2)
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < N1; i++) {
      sweep[side * N1 + i] = follow(
        rowB(i, N1, side ? QE1 : QC, side === 1),
        side === 1,
        false
      ).end
    }
  }
  const path = new Float32Array(NC * NR * 2)
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < NR; i++) {
      resample(
        follow(rowB(i, NR, side ? QE2 : QC, side === 1), side === 1, true),
        path,
        (side * NR + i) * NC
      )
    }
  }
  PS = new Float64Array(0)
  US = PS
  DS = PS
  return { sweep, path }
}

/** Rows of the camera table (camTable) */
export const NCAM = 512
const GX = [
  0.0092196829, 0.0479413718, 0.115048663, 0.2063410229, 0.3160842505,
  0.4373832957, 0.5626167043, 0.6839157495, 0.7936589771, 0.884951337,
  0.9520586282, 0.9908822795,
]
const GW = [
  0.0235876682, 0.053469663, 0.0800391643, 0.1015837134, 0.1167462683,
  0.1245735229, 0.1245735229, 0.1167462683, 0.1015837134, 0.0800391643,
  0.053469663, 0.0235876682,
]
/**
 * How far a ray from a camera D out has turned round the hole, counted from far away, when it reaches the
 * camera: row i is the ray at psi = i / (NCAM - 1) * 90 deg from straight at the hole (a ray as far from
 * straight out reads the same row). Into `out` (NCAM). With u sqrt(1 - u) = sqrt(C) sin(th) the integral
 * of du / sqrt(C - u^2 + u^3) is smooth in th.
 */
export function camTable(D: number, out: Float32Array) {
  const uc = 1 / D
  for (let i = 0; i < NCAM; i++) {
    const psi = (i / (NCAM - 1)) * (Math.PI / 2)
    const sp = Math.max(Math.sin(psi), 1e-9)
    const C = (uc * uc) / (sp * sp) - uc * uc * uc
    const th1 = Math.asin(Math.min((uc * Math.sqrt(1 - uc)) / Math.sqrt(C), 1))
    let s = 0
    for (let k = 0; k < 12; k++) {
      const w = Math.sqrt(C) * Math.sin(GX[k] * th1)
      let u = w
      for (let j = 0; j < 6; j++) u = w / Math.sqrt(1 - u)
      s += (GW[k] * Math.sqrt(1 - u)) / (1 - 1.5 * u)
    }
    out[i] = s * th1
  }
  return out
}
