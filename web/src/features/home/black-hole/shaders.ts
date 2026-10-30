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
// Gargantua over the night Earth. Everything renders in linear HDR; a bloom
// chain stands in for the IMAX lenses' veiling flare, then a film grade.
// The hole follows what Double Negative published about Interstellar's disk
// (James, von Tunzelmann, Franklin & Thorne 2015, Class. Quantum Grav. 32 065001):
// a thin disk in the equatorial plane, marginally optically thick, one
// temperature (4500 K) everywhere, no Doppler shifts, seen from a few degrees
// above its plane. Its rays come from tables (lens.ts), not stepped one by one.

import { BC, N1, NC, NCAM, NR, Q0, QC, QE1, QE2 } from './lens'

export const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2. - 1., 0., 1.);
}`

const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
#define TAU 6.28318530718
#define PI 3.14159265359
float sq(float x) { return x * x; }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
// display (sRGB) -> the linear light the grade's ACES curve turns into it: the sky is painted
// on the screen's terms, like the night sea's canvas, and goes through the same grade as the rest
vec3 toHDR(vec3 c) {
  vec3 y = clamp(pow(max(c, 0.), vec3(2.2)), 0., .97);
  vec3 A = 2.51 - 2.43 * y, B = .03 - .59 * y;
  return (-B + sqrt(B * B + .56 * A * y)) / (2. * A);
}
// the night sea's soft light round the pointer (a screen-blend colour, display terms): d = distance / radius
vec3 spotAt(float d) {
  if (d >= 1.) return vec3(0.);
  return d < .3 ? mix(vec3(186, 204, 246) * .13, vec3(160, 180, 230) * .05, d / .3) / 255. : vec3(160, 180, 230) * .05 / 255. * (1. - (d - .3) / .7);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3. - 2. * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
`

/**
 * Bakes the disk's polar texture once: x wraps around the disk, y runs from the
 * inner edge out to the end of the wisps.
 * r = fine streaks (gas wound into rings), g = clumps, b = how far out the edge
 * reaches at this angle.
 */
export const BAKE_DISK = `${PRELUDE}
out vec4 fragColor;
uniform vec4 uBake;   // swirl, streak length, tears, contrast
// noise that wraps around the disk: kx bumps per turn, ky across the radius
float pn(vec2 q, float kx, float ky, float seed) {
  float a = q.x * TAU, rho = kx / TAU;
  return noise3(vec3(cos(a) * rho + seed, sin(a) * rho - seed * .7, q.y * ky + seed * 3.1));
}
void main() {
  vec2 q = gl_FragCoord.xy / uRes;
  // the gas is sheared into streaks that wander in and out and cross
  float w1 = pn(q, 4., 6., 2.) - .5, w2 = pn(q, 11., 18., 5.) - .5, w3 = pn(q, 31., 55., 9.) - .5;
  vec2 w = vec2(q.x, q.y + uBake.x * (.06 * w1 + .025 * w2 + .012 * w3));
  float g = 0., amp = .5, kx = 5. / uBake.y, ky = 45., norm = 0.;
  for (int i = 0; i < 6; i++) {
    g += amp * pn(w, kx, ky, float(i) * 7.31);
    norm += amp;
    kx *= 2.1; ky *= 1.75; amp *= .62;
  }
  g /= norm;
  float c = .32 / uBake.w;
  float fil = smoothstep(.5 - c, .5 + c, g);
  // where the gas has torn thin, in patches drawn out round the disk
  float tear = smoothstep(.28, .68, .5 * pn(w, 16. / uBake.y, 10., 41.) + .3 * pn(w, 45. / uBake.y, 30., 13.) + .2 * pn(w, 120. / uBake.y, 70., 17.));
  float clump = mix(1., tear, uBake.z);
  float edge = .45 * pn(vec2(q.x, 0.), 3., 0., 21.) + .3 * pn(vec2(q.x, 0.), 11., 0., 33.) + .25 * pn(vec2(q.x, 0.), 40., 0., 47.);
  // short dashes: the torn wisps at the edge break up round the disk
  float fray = .6 * pn(w, 36., 9., 57.) + .4 * pn(w, 90., 20., 61.);
  fragColor = vec4(fil, clump, edge, fray);
}`

/**
 * Pass 1, the whole screen: the hole's light (linear HDR) over the sky it lenses.
 * rgb = light, a = how much of the sky behind still shows.
 * Sky: NASA/Goddard SVS Deep Star Maps 2020 (Milky Way, Gaia DR2: ESA/Gaia/DPAC)
 * and the Hipparcos-2 catalogue (van Leeuwen 2007) for the stars.
 */
export const HOLE = `${PRELUDE}
out vec4 fragColor;
uniform vec3 uCam;      // camera position (Schwarzschild radii, hole at the origin, disk in y = 0)
uniform mat3 uCamM;     // camera basis (columns: right, up, forward)
uniform vec4 uLens;     // hole centre (px), px per image unit, focal length
uniform vec2 uRoll;     // cos, sin of the image's turn
uniform vec4 uFlow;     // disk flow: phase-0 time, phase-1 time, phase-0 weight, angular speed
uniform vec2 uFlowO;    // phase-0 / phase-1 angle offsets (turns)
uniform vec4 uLook;     // disk light, shadow radius (image units)
uniform vec4 uLook2;    // optical depth, inner brightening, wisps, edge raggedness
uniform vec3 uPal[3];   // the gas where it is thick, where it is thin, where it is all but gone
uniform vec3 uGeo;      // the disk's inner edge, outer edge, the end of the wisps (Schwarzschild radii)
uniform vec2 uDust;     // the dusty glow round the outer disk: gain, thickness (share of the radius)
uniform sampler2D uDiskTex;
// the sky, in the Earth camera's terms
uniform vec3 uView;     // Earth camera: centre (px), focal length (px)
uniform vec4 uFrame;    // the frame the look is set in (knobs.ts lookFrame): the canvas's offset in it, its size (px)
uniform mat3 uHoleM;    // the hole's screen-aligned frame -> Earth camera space
uniform mat3 uSkyM;     // Earth camera space -> celestial (J2000)
// the Milky Way (tools/mw_bake.py): its light on a log scale (0..1, the luminance) times its colour
uniform sampler2D uMilky;     // the whole sky (equirectangular)
uniform highp usampler2D uCells;
uniform sampler2D uStarList;
uniform vec4 uSky;      // unused, unused, catalogue stars, deep stars
uniform vec4 uSky2;     // device px per CSS px, unused, twinkle, time
uniform vec4 uMW;       // the Milky Way at its brightest (HDR), its black point and brightest (on the map's log scale), its curve
uniform vec4 uMW2;      // how much of the map's own colour, how much softer where the hole stretches it, the deep field before you look, unused
uniform vec3 uNight;    // the dark between the stars (display)
uniform vec4 uGlow;     // the night sea's glow low in the sky (display); w: its opacity, as much of it as shows now
uniform vec2 uGlowY;    // it starts (none) and is full at these shares of the screen, from the top
uniform vec2 uBand;     // the Milky Way read this much softer, its deep stars shown before you look (share)
uniform vec3 uBandC;    // its colour where faint
uniform vec4 uLook3;    // faint sky before you look, dark adaptation and bright stars' wake (1: as the poster shows them), the night's blue
uniform vec4 uPtr;      // the pointer (device px, from the bottom left), presence, soft light's radius (device px)
uniform vec4 uShift;    // the sky behind the hole moved (rad, along its right and up), and the radii (rad) between which that fades out
uniform sampler2D uMask; // where you have looked (MASK, a quarter of the resolution)
uniform vec4 uEarth;    // the Earth's centre in the Earth camera's space (radius 1); w = 1 while it is in view
// the Earth and its air, worked out once (engine.ts cacheEarth) for the screen's lowest uEarthTop device px:
// what of the sky still shows (rgb) and how much ground covers it (a); their light
uniform sampler2D uEarthMul;
uniform sampler2D uEarthAdd;
uniform float uEarthTop;
uniform float uCellN;
uniform float uSkyMag;  // the most the hole may brighten a star
// the lens tables (lens.js)
uniform highp sampler2D uSweep;
uniform highp sampler2D uPath;
uniform highp sampler2D uCamPhi; // how far the camera's rays have turned when they reach it (lens.js camTable)

#define RIN uGeo.x
#define ROUT uGeo.y
#define RW uGeo.z

void disk(vec3 xc, vec3 vd, float dist, float pxA, inout vec3 col, inout float T) {
  float rr = length(xc.xz);
  float u = (rr - RIN) / (RW - RIN);
  float phi = atan(xc.z, xc.x);
  float om = uFlow.w * pow(rr / RIN, -1.5);
  // the pixel's footprint on the disk, in texels: seen edge-on it smears across the radius
  float fa = pxA * dist;
  float lr = fa / max(abs(vd.y), .04) / (RW - RIN) * 2048.;
  float la = fa / rr / TAU * 2048.;
  float lod = log2(max(max(lr * .5, la), 1.));
  vec4 a = textureLod(uDiskTex, vec2((phi + om * uFlow.x) / TAU + uFlowO.x, u), lod);
  vec4 b = textureLod(uDiskTex, vec2((phi + om * uFlow.y) / TAU + uFlowO.y, u), lod);
  float w = uFlow.z;
  vec2 n = clamp((mix(b.rg, a.rg, w) - .5) * inversesqrt(w * w + (1. - w) * (1. - w)) + .5, 0., 1.);
  float fil = n.x, clump = n.y;
  float edge = mix(b.b, a.b, w), fray = mix(b.a, a.a, w);
  // near the inner edge the gas is thick and even: the hottest part, and what the photon ring shows
  float even = 1. - smoothstep(RIN, RIN + .25 * (ROUT - RIN), rr);
  fil = mix(fil, 1., even * .75);
  clump = mix(clump, 1., even * .85);
  float span = ROUT - RIN;
  float rEdge = ROUT + (edge - .5) * .45 * span * uLook2.w;
  float inner = smoothstep(RIN - .05, RIN + .3, rr);
  float body = 1. - smoothstep(rEdge - .35 * span, rEdge + .05 * span, rr);
  // past the edge only the strongest streaks go on, as torn wisps
  float wisp = (1. - smoothstep(rEdge - .1 * span, RW, rr)) * smoothstep(.35, .9, fil * clump) * smoothstep(.35, .8, fray) * uLook2.z;
  float dens = inner * (body * (.05 + 1.3 * fil * sqrt(fil)) * (.2 + .95 * clump) + wisp);
  dens *= mix(1.6, .35, smoothstep(RIN, ROUT, rr));
  float tau = dens * uLook2.x / max(abs(vd.y), .015);
  float al = 1. - exp(-tau);
  // one temperature: the light depends on how much gas there is, not on the radius
  float S = 1. + uLook2.y * sq(RIN / rr);
  vec3 tint = mix(mix(uPal[2], uPal[1], smoothstep(.02, .3, al)), uPal[0], smoothstep(.3, .9, al));
  col += T * al * S * tint;
  T *= 1. - al;
}

// Every ray round the hole is one of a single family (lens.js): u = 1/r against the angle phi it has
// turned obeys (u')^2 + u^2 - u^3 = C, and b = 1/sqrt(C) says which. Tables give how far each turns
// and where it is on the way; the camera, a little way out, starts partway along its ray.
const float BC = ${BC.toFixed(12)};
const float Q0 = ${Q0.toFixed(1)}, QC = ${QC.toFixed(9)}, QE1 = ${QE1.toFixed(9)}, QE2 = ${QE2.toFixed(9)};
const int N1 = ${N1}, NC = ${NC}, NR = ${NR};
// row coordinate (0 .. n-1) of b on its side of BC, for a table reaching q1
float rowOf(float b, float q1, int n) {
  float q = log(max(abs(b - BC), 1e-30));
  return clamp((q - Q0) / (q1 - Q0), 0., 1.) * float(n - 1);
}
// how far a ray turns, from far away, in to its closest approach (away) or to r = 1.4 (taken): Catmull-Rom between rows
float sweepOf(float b, bool away) {
  int side = away ? 1 : 0;
  float x = rowOf(b, away ? QE1 : QC, N1);
  float fi = floor(x), t = x - fi;
  int i = int(fi);
  float p0 = texelFetch(uSweep, ivec2(max(i - 1, 0), side), 0).r, p1 = texelFetch(uSweep, ivec2(i, side), 0).r;
  float p2 = texelFetch(uSweep, ivec2(min(i + 1, N1 - 1), side), 0).r, p3 = texelFetch(uSweep, ivec2(min(i + 2, N1 - 1), side), 0).r;
  return p1 + .5 * t * (p2 - p0 + t * (2. * p0 - 5. * p1 + 4. * p2 - p3 + t * (3. * (p1 - p2) + p3 - p0)));
}
// u where the ray is, a share f (0..1) of the way along that turn
float pathOf(float b, float f, bool away) {
  float y = rowOf(b, away ? QE2 : QC, NR) + (away ? float(NR) : 0.);
  float x = clamp(f, 0., 1.) * float(NC - 1);
  ivec2 i = ivec2(floor(vec2(x, y)));
  vec2 t = vec2(x, y) - vec2(i);
  ivec2 j = min(i + 1, ivec2(NC - 1, 2 * NR - 1));
  float a = texelFetch(uPath, i, 0).r, c = texelFetch(uPath, ivec2(j.x, i.y), 0).r;
  float d = texelFetch(uPath, ivec2(i.x, j.y), 0).r, e = texelFetch(uPath, j, 0).r;
  return mix(mix(a, c, t.x), mix(d, e, t.x), t.y);
}
const int NCAM = ${NCAM};
// how far the ray has turned, from far away, by the time it reaches the camera (psi = its angle from straight at the hole)
float camPhi(float psi) {
  float x = min(psi, PI - psi) / (.5 * PI) * float(NCAM - 1);
  int i = min(int(x), NCAM - 2);
  return mix(texelFetch(uCamPhi, ivec2(i, 0), 0).r, texelFetch(uCamPhi, ivec2(i + 1, 0), 0).r, x - float(i));
}
void trace(vec2 uv, float pxA, out vec3 col, out float T, out float captured, out vec3 v, out float dust) {
  vec3 rd = normalize(uCamM * vec3(uv, uLens.w));
  vec3 x0 = uCam;
  float D = length(x0);
  vec3 e1 = x0 / D;
  col = vec3(0.);
  T = 1.;
  captured = 0.;
  dust = 0.;
  v = rd;
  float cps = -dot(rd, e1);
  vec3 pp = rd + cps * e1;
  float sps = length(pp);
  if (sps < 1e-7) { captured = step(0., cps); return; }
  vec3 e2 = pp / sps;
  float uc = 1. / D;
  float C = uc * uc / (sps * sps) - uc * uc * uc;
  float b = inversesqrt(C);
  float phc = camPhi(atan(sps, cps));
  // heading out: gone at once, never near the disk
  if (cps < 0.) { v = cos(phc) * e1 + sin(phc) * e2; return; }
  bool away = b > BC;
  float sw = sweepOf(b, away);
  float total = away ? 2. * sw - phc : sw - phc;
  captured = away ? 0. : 1.;
  // where the ray's plane meets the disk's: every half turn from ph0 on
  if (b < BC + 12. && abs(e1.y) + abs(e2.y) > 1e-6) {
    float ph0 = mod(atan(e2.y, e1.y) + .5 * PI, PI);
    if (ph0 < 1e-5) ph0 += PI;
    for (int k = 0; k < 8; k++) {
      float ph = ph0 + float(k) * PI;
      if (ph >= total) break;
      float pin = phc + ph;
      bool inb = !away || pin <= sw;
      float u = pathOf(b, (inb ? pin : 2. * sw - pin) / sw, away);
      float r = 1. / max(u, 1e-6);
      if (r > RW * 1.15 || r < RIN - .2) continue;
      vec3 er = cos(ph) * e1 + sin(ph) * e2, ef = cos(ph) * e2 - sin(ph) * e1;
      float du = sqrt(max(C - u * u + u * u * u, 0.)) * (inb ? 1. : -1.);
      vec3 vd = normalize(u * ef - du * er);
      vec3 xc = r * er;
      // the outer disk's dusty glow: the layer this crossing goes through
      if (uDust.x > 0.)
        dust += T * smoothstep(ROUT * .75, ROUT * 1.05, r) * (1. - smoothstep(ROUT * 1.1, RW * 1.1, r)) * 2. * uDust.y / max(abs(vd.y), .06);
      if (r < RW) disk(xc, vd, length(xc - x0), pxA, col, T);
      if (T < .01) break;
    }
  }
  if (away) v = cos(total) * e1 + sin(total) * e2;
}

// a direction in the hole camera's space, carried to the Earth camera's
vec3 toEarth(vec3 c) {
  vec2 q = vec2(uRoll.x * c.x - uRoll.y * c.y, uRoll.y * c.x + uRoll.x * c.y);
  return uHoleM * vec3(q, c.z);
}
// x turned by the rotation that takes a to b (two mirrors: no handedness to get wrong)
vec3 turn(vec3 x, vec3 a, vec3 b) {
  vec3 n = a + b;
  float nn = max(dot(n, n), 1e-6);
  x -= 2. * dot(x, n) / nn * n;
  return x - 2. * dot(x, b) * b;
}

// A dot as the night sea's canvas draws one, d device px from its centre: a disc of radius r (device px)
// with an edge a pixel soft (a tiny one is a .6 px disc, as faint as its area); halo: one five radii
// wide over it, as the night sea gives its biggest stars
float starDot(float d, float r, bool halo) {
  float re = max(r, .6);
  float v = clamp(re + .5 - d, 0., 1.) * min(1., r * r / (re * re));
  return halo ? v + (1. - v) * .22 * max(0., 1. - d / (5. * r)) : v;
}

// The catalogue's stars near direction c, painted as the night sea paints its own (stars.ts): dots
// sized by how bright a star is among those that show, in the night sea's tints. The hole moves their
// images and brightens them (by their magnification, held to uSkyMag) but never stretches them, so
// each is found on the screen by undoing the lens's local map (cx, cy = the sky per device pixel across
// and up). The sky is cut into cube-face cells, each listing the stars within reach. s0 = the sky a
// device pixel covers without the hole; lit = the pointer's light here.
// Out (display terms, summed): the bright stars (they twinkle), the faint ones, the deep ones.
void catalogue(vec3 c, vec3 cx, vec3 cy, float s0, float lit, out vec3 bright, out vec3 faint, out vec3 deep) {
  bright = faint = deep = vec3(0.);
  float a11 = dot(cx, cx), a12 = dot(cx, cy), a22 = dot(cy, cy);
  float det = a11 * a22 - a12 * a12;
  if (det <= 0.) return;
  float k = min(s0 * s0 * inversesqrt(det), uSkyMag);
  vec3 a = abs(c);
  int face;
  vec2 st;
  if (a.x >= a.y && a.x >= a.z) { face = c.x > 0. ? 0 : 1; st = c.yz / a.x; }
  else if (a.y >= a.z) { face = c.y > 0. ? 2 : 3; st = c.xz / a.y; }
  else { face = c.z > 0. ? 4 : 5; st = c.xy / a.z; }
  int N = int(uCellN);
  ivec2 cell = clamp(ivec2((st * .5 + .5) * uCellN), ivec2(0), ivec2(N - 1));
  uint e = texelFetch(uCells, ivec2(cell.x + face * N, cell.y), 0).r;
  int start = int(e >> 5u), count = int(e & 31u);
  for (int i = 0; i < 31; i++) {
    if (i >= count) break;
    int j = (start + i) * 2;
    vec4 p = texelFetch(uStarList, ivec2(j & 2047, j >> 11), 0);
    vec4 f = texelFetch(uStarList, ivec2((j + 1) & 2047, (j + 1) >> 11), 0);
    vec3 dd = p.xyz - c;
    float b1 = dot(cx, dd), b2 = dot(cy, dd);
    vec2 q = vec2(a22 * b1 - a12 * b2, a11 * b2 - a12 * b1) / det;   // device px to the star's image
    float r = p.w * uSky2.x, d = length(q);
    bool halo = p.w > 1.4;
    if (d > (halo ? 5. * r : r + 1.5)) continue;
    vec3 col = f.rgb * starDot(d, r, halo) * k;
    float g = floor(f.w * .1), ph = f.w - 10. * g;
    if (g > 1.5) deep += col;
    else if (g > .5) faint += col;
    else {
      float w = .6 + 1.8 * fract(ph * 7.13);
      bright += col * mix(1., .72 + .28 * sin(uSky2.w * w + ph), uSky2.z) * (1. + .5 * lit);
    }
  }
}

// The deep field the night sea keeps for where you look: its small faint dots (.3 to .75 CSS px, .3 to .8
// opaque, its three tints), scattered over cube-face cells (one at most each, well inside it), thicker in
// the Milky Way (mw: how bright it is here, 0..1). Display terms, like the catalogue's (see there).
vec3 deepField(vec3 c, vec3 cx, vec3 cy, float s0, float cells, float mw) {
  float a11 = dot(cx, cx), a12 = dot(cx, cy), a22 = dot(cy, cy);
  float det = a11 * a22 - a12 * a12;
  if (det <= 0.) return vec3(0.);
  vec3 a = abs(c);
  int face;
  vec2 st;
  if (a.x >= a.y && a.x >= a.z) { face = c.x > 0. ? 0 : 1; st = c.yz / a.x; }
  else if (a.y >= a.z) { face = c.y > 0. ? 2 : 3; st = c.xz / a.y; }
  else { face = c.z > 0. ? 4 : 5; st = c.xy / a.z; }
  vec2 g = (st * .5 + .5) * cells;
  vec2 cell = floor(g);
  vec3 h = hash33(vec3(cell, float(face) * 17.3 + 5.));
  if (h.x > .1 + .5 * mw) return vec3(0.);
  vec2 q2 = (cell + .25 + .5 * h.yz) / cells * 2. - 1.;
  float sgn = (face == 1 || face == 3 || face == 5) ? -1. : 1.;
  vec3 p = face < 2 ? vec3(sgn, q2) : face < 4 ? vec3(q2.x, sgn, q2.y) : vec3(q2, sgn);
  vec3 dd = normalize(p) - c;
  float b1 = dot(cx, dd), b2 = dot(cy, dd);
  vec2 q = vec2(a22 * b1 - a12 * b2, a11 * b2 - a12 * b1) / det;
  vec3 k = hash33(vec3(cell.yx, float(face) + 41.));
  vec3 tint = k.z < .12 ? vec3(196, 214, 255) : k.z < .2 ? vec3(255, 238, 220) : vec3(238, 241, 250);
  return tint / 255. * (.3 + .5 * k.x) * starDot(length(q), (.3 + .45 * k.y) * uSky2.x, false) * min(s0 * s0 * inversesqrt(det), uSkyMag);
}

// The Milky Way here, from the whole sky's map, read softer by uBand.x: the night sea's haze, not the
// map's grain. cx, cy = the sky per device pixel across and up (the map's footprint, worked out, not
// from neighbouring pixels). Where the hole stretches the sky (str times along its most drawn-out
// direction: round its Einstein ring) it is read softer still, so the lensed Milky Way comes out as
// smooth arcs, not hairs.
vec3 milkyAt(vec3 cel, vec3 cx, vec3 cy, float str) {
  float soft = pow(clamp(str, 1., 12.), uMW2.y) * uBand.x;
  cx *= soft;
  cy *= soft;
  float r2 = max(dot(cel.xy, cel.xy), 1e-12), iz = inversesqrt(max(1. - cel.z * cel.z, 1e-12));
  vec2 m1 = vec2(.5 - atan(cel.y, cel.x) / TAU, .5 - asin(clamp(cel.z, -1., 1.)) / PI);
  vec2 gx = vec2((cel.y * cx.x - cel.x * cx.y) / (r2 * TAU), -cx.z * iz / PI);
  vec2 gy = vec2((cel.y * cy.x - cel.x * cy.y) / (r2 * TAU), -cy.z * iz / PI);
  return textureGrad(uMilky, m1, gx, gy).rgb;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  // the Earth kept from cacheEarth: what of the sky shows through its air, how much ground covers it, their
  // light; the pointer's soft light falls on the ground too
  vec4 em = vec4(1., 1., 1., 0.);
  vec3 ea = vec3(0.);
  if (fc.y < uEarthTop) {
    em = texelFetch(uEarthMul, ivec2(fc), 0);
    ea = texelFetch(uEarthAdd, ivec2(fc), 0).rgb;
    if (uPtr.z > 0.) ea += em.a * toHDR(spotAt(length(fc - uPtr.xy) / uPtr.w) * uPtr.z);
  }
  // what the Earth hides needs no sky (a few pixels' margin for its antialiased limb)
  if (uEarth.w > 0.) {
    vec3 d = normalize(vec3((fc - uView.xy) / uView.z, 1.));
    float dc = length(uEarth.xyz);
    if ((acos(clamp(dot(uEarth.xyz, d) / dc, -1., 1.)) - asin(1. / dc)) * uView.z < -4.) { fragColor = vec4(ea, 0.); return; }
  }
  float S = uLens.z, foc = uLens.w;
  vec2 q = (fc - uLens.xy) / S;
  vec2 uv = vec2(uRoll.x * q.x + uRoll.y * q.y, -uRoll.y * q.x + uRoll.x * q.y);
  float pxA = 1. / (S * foc);
  // the shadow's edge and the photon ring just outside it (the disk seen after a turn round the hole):
  // thinner than a pixel and very bright, so it takes more rays per pixel or it beads
  float edge = (length(uv) - uLook.y) * S;
  int n = edge > -2. && edge < max(3., uLook.y * S * .09) ? 9 : 1;
  vec3 col = vec3(0.), v = vec3(0.);
  float T = 0., captured = 0., dust = 0.;
  for (int i = 0; i < 9; i++) {
    if (i >= n) break;
    float a = float(i) * 2.39996 + .4, rr = i == 0 ? 0. : sqrt((float(i) - .5) / 8.) * .62;
    vec3 c1, v1;
    float T1, k1, d1;
    trace(uv + vec2(cos(a), sin(a)) * rr / S, pxA, c1, T1, k1, v1, d1);
    col += c1; T += T1; captured += k1; dust += d1;
    if (i == 0) v = v1;
  }
  col /= float(n); T /= float(n); captured /= float(n); dust /= float(n);
  col += mix(uPal[2], uPal[1], .35) * dust * uDust.x;
  col *= uLook.x;
  float open = T * (1. - captured);

  // the sky this pixel sees: its own direction from the Earth camera, turned
  // as much as the hole bent the ray
  vec3 rd = normalize(uCamM * vec3(uv, foc));
  mat3 back = transpose(uCamM);
  vec3 dE = normalize(vec3((fc - uView.xy) / uView.z, 1.));
  vec3 sd = turn(dE, normalize(toEarth(back * rd)), normalize(toEarth(back * v)));
  // near the hole the sky behind it is moved a little (the pointer pulls it): seen through the lens
  // the stars there flow round the ring; further out nothing moves
  vec3 Lh = uHoleM[2];
  float th = acos(clamp(dot(dE, Lh), -1., 1.));
  sd = normalize(sd + (1. - smoothstep(uShift.z, uShift.w, th)) * (uShift.x * uHoleM[0] + uShift.y * uHoleM[1]));
  vec3 cel = uSkyM * sd;
  // the size of a pixel on the sky here (the hole magnifies it near its edge)
  vec3 cx = dFdx(cel), cy = dFdy(cel);
  float s = sqrt(length(cross(cx, cy)));
  float s0 = 1. / uView.z;
  // where this bit of sky would be on the screen without the hole: the pointer's reveal and light
  // are on the sky, so they bend round the hole with the stars
  vec2 ps = sd.z > .05 ? uView.xy + uView.z * sd.xy / sd.z : vec2(-1e5);
  vec2 mq = ps / uRes;
  float look = all(greaterThan(mq, vec2(0.))) && all(lessThan(mq, vec2(1.))) ? texture(uMask, mq).r : 0.;
  float dsp = length(ps - uPtr.xy) / uPtr.w;
  float lit = uPtr.z * max(0., 1. - dsp);
  // the Milky Way: NASA's map from its black point up to its brightest on a log scale (as a photograph is
  // stretched), cool where it is faint, cream in its bright clouds, a little of the map's own dust colour
  // how far the hole draws the sky out here, along its most stretched direction (the least sky per pixel)
  float a11 = dot(cx, cx), a12 = dot(cx, cy), a22 = dot(cy, cy);
  float lmin = .5 * (a11 + a22) - sqrt(.25 * sq(a11 - a22) + a12 * a12);
  float str = s0 * inversesqrt(max(lmin, 1e-30));
  vec3 mwm = milkyAt(cel, cx, cy, str);
  float Ib = dot(mwm, vec3(.2126, .7152, .0722));
  float I = pow(clamp((Ib - uMW.y) / (uMW.z - uMW.y), 0., 1.), uMW.w);
  vec3 chroma = mix(uBandC, vec3(1., .95, .87), smoothstep(.35, 1., I));
  chroma *= mix(vec3(1.), mwm / max(Ib, 1e-3), uMW2.x);
  vec3 bright, faint, deep;
  bright = faint = deep = vec3(0.);
  catalogue(cel, cx, cy, s0, lit, bright, faint, deep);
  // painted as the night sea paints its sky: the faint part at "rest" until you look, the deep field only where you look
  float rest = uLook3.x, adapt = uLook3.y;
  float seeFaint = adapt * (rest + (1. - rest) * look);
  // in the light the grade turns into the screen's (the night and its glow are display colours)
  float glowY = clamp((1. - (gl_FragCoord.y + uFrame.y) / uFrame.w - uGlowY.x) / (uGlowY.y - uGlowY.x), 0., 1.);
  vec3 sky = toHDR(uNight + uGlow.rgb * uGlow.w * glowY) * uLook3.w + uMW.x * pow(I, 1.6) * chroma * seeFaint;
  if (dsp < 1. && uPtr.z > 0.) sky += toHDR(spotAt(dsp) * uPtr.z);
  // the deep field (too faint for the catalogue: the stars NASA's map leaves out) faintly everywhere, more where you look
  // (the deep stars in the Milky Way show before you look too, as the night sea's band does: uBand.y);
  // where none of it shows it is not worked out
  float dfv = max(uMW2.z, uBand.y * smoothstep(.15, .8, I));
  float dfw = uSky.w * adapt * (dfv + (1. - dfv) * look);
  vec3 df = dfw > 0. ? deepField(cel, cx, cy, s0, 1.5708 / (4. * uSky2.x * s0), I) : vec3(0.);
  vec3 stars = faint * uSky.z * seeFaint + (deep + df) * dfw + bright * uSky.z * uLook3.z;
  sky += toHDR(stars);
  col += open * sky;
  col = col * em.rgb + ea;
  // a ray straight at the centre can come out NaN; the blur and bloom would spread it
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.);
  fragColor = vec4(min(col, vec3(6e4)), open);
}`

/**
 * Where you have looked (the hole pass reads it where the sky it shows would be without the
 * hole): the pointer's dab and its trail, at a quarter of the resolution, only while there is any.
 */
export const MASK = `${PRELUDE}
out vec4 fragColor;
uniform float uScale;   // device px of the hole's picture per px of this one
// the pointer now (x, y, radius in device px from the bottom left, presence) and its trail (the same,
// strength for presence: older, fainter and narrower), all inside uTrailBox (min x, min y, max x, max y);
// uTrailK: the night sea's dabs laid along a trail per device px of radius
uniform vec4 uCur;
uniform vec4 uTrail[32];
uniform int uTrailN;
uniform vec4 uTrailBox;
uniform float uTrailK;
// The night sea's dab: its radial gradient (opaque, .8 at .45 of the radius, gone at the edge); t = distance / radius
float dab(float t) {
  return t < .45 ? 1. - t * .4444 : max(0., .8 * (1. - (t - .45) / .55));
}
// How much of the sky at p (device px) has been looked at: the pointer's own dab, and its trail. The night
// sea laid a dab every few pixels along the way, so a trail is nearly opaque until it is old; here each
// stretch between two of its points stands for the dabs laid along it (as many as cover p).
float reveal(vec2 p) {
  float m = 0.;
  float dc = length(p - uCur.xy);
  if (uCur.w > .003 && dc < uCur.z) m = uCur.w * dab(dc / uCur.z);
  if (uTrailN == 0 || any(lessThan(p, uTrailBox.xy)) || any(greaterThan(p, uTrailBox.zw))) return m;
  float keep = 1.;
  for (int i = 0; i < 32; i++) {
    if (i >= uTrailN) break;
    vec4 a = uTrail[i], b = uTrail[min(i + 1, uTrailN - 1)];
    vec2 ab = b.xy - a.xy;
    float l2 = dot(ab, ab);
    float h = l2 > 0. ? clamp(dot(p - a.xy, ab) / l2, 0., 1.) : 0.;
    float r = mix(a.z, b.z, h), k = mix(a.w, b.w, h);
    float d = length(p - a.xy - ab * h);
    if (d >= r || k <= .003) continue;
    float t = d / r;
    keep = min(keep, pow(1. - k * dab(t), max(1., uTrailK * r * sqrt(1. - t * t))));
  }
  return 1. - (1. - m) * keep;
}
void main() {
  fragColor = vec4(reveal(gl_FragCoord.xy * uScale), 0., 0., 1.);
}`

/**
 * The screen's lower part, worked out once (engine.ts cacheEarth): the wallet card's Earth
 * (the night side under its city lights, blue-white limb, green airglow) with the hole far
 * off in the sky as its only light, in two parts the hole pass applies: uPart 0 = how much
 * of the sky behind still shows (rgb) and how much ground covers it (a), 1 = the light
 * added. Camera space: x right, y up, z forward; the Earth has radius 1.
 * City lights and land: NASA Earth Observatory, Black Marble 2016 (public domain).
 */
export const COMPOSITE = `${PRELUDE}
out vec4 fragColor;
uniform int uPart;
uniform sampler2D uHoleBlur;
uniform sampler2D uCity;   // city lights under the view (a box of longitude x latitude), stored as sqrt
uniform sampler2D uMoon;   // the same box by moonlight (sRGB)
uniform vec4 uCityBox;     // that box in the whole map's uv: left, top, 1 / width, 1 / height
uniform sampler2D uLand;   // the whole Earth, coarse
uniform vec2 uC;
uniform float uF;
uniform vec3 uEarthC;
uniform mat3 uEM;
uniform vec3 uL;           // towards the hole
uniform vec4 uAir;         // scale height, rim gain, airglow gain, haze gain
uniform vec4 uSun;         // the hole's light on the Earth, city lights gain, glint gain, time
uniform vec3 uAirPal[3];   // the hole's light in the air, how the low air reddens it, its colour on the ground
uniform vec4 uTune;        // moonlit land, limb line, glow round the lights, aureole in the air
uniform float uRimFloor;   // how bright the limb stays far from the hole

vec3 scatter(float c) {
  float ray = .75 * (1. + c * c);
  float g = .78, mie = (1. - g * g) / pow(1. + g * g - 2. * g * c, 1.5) * .08;
  return vec3(.16, .38, 1.) * ray + uAirPal[0] * mie;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 suv = fc / uRes;
  vec3 d = normalize(vec3((fc - uC) / uF, 1.));
  vec3 C = uEarthC;
  float dc = length(C), tca = dot(C, d);
  float b2 = max(dc * dc - tca * tca, 0.);
  float edge = (acos(clamp(tca / dc, -1., 1.)) - asin(1. / dc)) * uF;
  float cover = clamp(.5 - edge, 0., 1.);
  float Hs = uAir.x;
  float sun = uSun.x;
  float cl = dot(d, uL);
  vec3 aur = texture(uHoleBlur, suv).rgb;

  vec3 air = vec3(0.), trans = vec3(1.);
  if (edge > -1.) {
    vec3 lp = d * max(tca, 0.) - C;
    float lpl = length(lp);
    float h = max(lpl - 1., 0.);
    vec3 low = lp / max(lpl, 1e-6);
    float up = max(-tca / dc, 0.);
    float rise = 1. / (1. + up / sqrt(2. * Hs));
    float lit = smoothstep(-.16, .22, dot(low, uL)) * sun;
    float tau = exp(-h / Hs) * 2.4 * rise;
    // brightest under the hole, like a sunrise; a thin dim line far round the limb
    float near = uRimFloor + (1. - uRimFloor) * pow(smoothstep(.55, .995, cl), 1.5);
    vec3 rim = (1. - exp(-tau * vec3(.7, .85, 1.))) * exp(-tau * uAirPal[1]) * scatter(cl) * lit * uAir.y * near;
    // the air also scatters the disk's light forward round it
    rim += (1. - exp(-tau * vec3(.6, .8, 1.))) * aur * uTune.w * lit;
    float line = exp(-h / (Hs * .35)) * uTune.y * (.3 + .7 * lit) * rise;
    float ag = exp(-sq((h - Hs * 1.7) / (Hs * .22))) * uAir.z * (1. - .85 * lit) * rise * rise;
    air = rim + vec3(.5, .72, 1.) * line * .05 + vec3(.35, .9, .62) * ag;
    trans = exp(-tau * uAirPal[1] * .6);
  }
  if (uPart == 0) { fragColor = vec4(trans * (1. - cover), cover); return; }
  if (cover <= 0.) { fragColor = vec4(air, 1.); return; }

  float thc = sqrt(max(1. - b2, 0.));
  vec3 p = d * (tca - thc);
  vec3 n = normalize(p - C);
  vec3 e = uEM * n;
  vec2 tuv = vec2(atan(e.y, e.x) / TAU + .5, .5 - asin(clamp(e.z, -1., 1.)) / PI);
  vec2 tuv2 = vec2(fract(tuv.x + .5), tuv.y);
  vec2 gx = dFdx(tuv), gy = dFdy(tuv), gx2 = dFdx(tuv2), gy2 = dFdy(tuv2);
  if (abs(gx.x) + abs(gy.x) > abs(gx2.x) + abs(gy2.x)) { gx = gx2; gy = gy2; }
  vec2 cuv = (tuv - uCityBox.xy) * uCityBox.zw;
  vec2 cgx = gx * uCityBox.zw, cgy = gy * uCityBox.zw;
  float inBox = step(0., cuv.x) * step(cuv.x, 1.) * step(0., cuv.y) * step(cuv.y, 1.);
  float city = textureGrad(uCity, cuv, cgx, cgy).r * inBox;
  float glow1 = textureGrad(uCity, cuv, cgx * 3., cgy * 3.).r * inBox;
  float glow2 = textureGrad(uCity, cuv, cgx * 9., cgy * 9.).r * inBox;
  vec3 moon = pow(textureGrad(uMoon, cuv, cgx, cgy).rgb, vec3(2.2));
  float land = smoothstep(.07, .13, textureGrad(uLand, tuv, gx, gy).r);
  float mu = dot(n, uL);
  float view = max(dot(-d, n), 0.);
  float airMass = 1. / (view + .035);
  float day = smoothstep(-.02, .2, mu) * sun;
  float night = 1. - smoothstep(-.06, .08, mu);

  vec3 coarse = mix(vec3(.0012, .0014, .0038), vec3(.0042, .0046, .0095), land);
  vec3 ground = mix(coarse, moon, inBox) * uTune.x;
  ground *= .35 + .65 * pow(clamp(view / .28, 0., 1.), .7);
  ground += mix(vec3(.012, .032, .08), vec3(.05, .046, .04), land) * uAirPal[2] * day * max(mu, 0.) * 4.;
  float lt = pow(city * city, 1.15);
  glow1 *= glow1;
  glow2 *= glow2;
  vec3 amber = vec3(1., .49, .14), hot = vec3(1., .84, .58);
  vec3 lights = (lt * amber * 1.15 + max(lt - .55, 0.) * hot * 1.4 + (glow1 * .55 + glow2 * .35) * amber * uTune.z) * uSun.y * night;
  vec3 ext = exp(-airMass * Hs * vec3(3.2, 5.5, 9.));
  vec3 col = (ground + lights) * ext;

  // the hole glinting in the sea: its blurred image, mirrored
  vec3 r = reflect(d, n);
  if (r.z > .02 && land < .9) {
    vec2 sp = uC + r.xy / r.z * uF;
    sp.x += (noise(vec2(fc.x * .01, fc.y * .08 - uSun.w * .6)) - .5) * 6.;
    vec3 l = texture(uHoleBlur, sp / uRes).rgb;
    float fres = .02 + .98 * pow(1. - view, 5.);
    col += l * fres * uSun.z * (1. - land);
  }
  vec3 haze = (1. - exp(-airMass * Hs * 1.6 * vec3(.7, .85, 1.))) * scatter(cl) * smoothstep(-.16, .22, mu) * sun * uAir.w * (.35 + .65 * smoothstep(.75, .97, cl));
  haze += (1. - exp(-airMass * Hs * 1.6 * vec3(.6, .8, 1.))) * aur * uTune.w * smoothstep(-.16, .22, mu);
  col += haze;
  fragColor = vec4(mix(air, col, cover), 1.);
}`

/** Bloom: 13-tap downsample (Jimenez 2014) */
export const DOWN = `${PRELUDE}
out vec4 fragColor;
uniform sampler2D uSrc;
uniform vec2 uTexel;   // the source's texel size
uniform float uThr;    // only light above this blooms (first level), 0 = all
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 t = uTexel;
  vec3 a = texture(uSrc, uv + t * vec2(-2, 2)).rgb, b = texture(uSrc, uv + t * vec2(0, 2)).rgb, c = texture(uSrc, uv + t * vec2(2, 2)).rgb;
  vec3 d = texture(uSrc, uv + t * vec2(-2, 0)).rgb, e = texture(uSrc, uv).rgb, f = texture(uSrc, uv + t * vec2(2, 0)).rgb;
  vec3 g = texture(uSrc, uv + t * vec2(-2, -2)).rgb, h = texture(uSrc, uv + t * vec2(0, -2)).rgb, i = texture(uSrc, uv + t * vec2(2, -2)).rgb;
  vec3 j = texture(uSrc, uv + t * vec2(-1, 1)).rgb, k = texture(uSrc, uv + t * vec2(1, 1)).rgb;
  vec3 l = texture(uSrc, uv + t * vec2(-1, -1)).rgb, m = texture(uSrc, uv + t * vec2(1, -1)).rgb;
  vec3 o = e * .125 + (a + c + g + i) * .03125 + (b + d + f + h) * .0625 + (j + k + l + m) * .125;
  if (uThr > 0.) { float l = max(max(o.r, o.g), o.b); o *= smoothstep(uThr * .5, uThr * 1.5, l) * max(l - uThr * .5, 0.) / max(l, 1e-4); }
  fragColor = vec4(min(o, vec3(6e4)), 1.);
}`

/** Bloom: tent upsample of the smaller level, added to this level times its weight */
export const UP = `${PRELUDE}
out vec4 fragColor;
uniform sampler2D uLow;    // the smaller level, already accumulated
uniform sampler2D uCur;    // this level of the downsample chain
uniform vec2 uTexel;       // the smaller level's texel size
uniform vec3 uW;           // this level's weight and tint
uniform float uLowW;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 t = uTexel;
  vec3 s = texture(uLow, uv + t * vec2(-1, 1)).rgb + texture(uLow, uv + t * vec2(1, 1)).rgb
         + texture(uLow, uv + t * vec2(-1, -1)).rgb + texture(uLow, uv + t * vec2(1, -1)).rgb
         + 2. * (texture(uLow, uv + t * vec2(0, 1)).rgb + texture(uLow, uv + t * vec2(0, -1)).rgb
               + texture(uLow, uv + t * vec2(-1, 0)).rgb + texture(uLow, uv + t * vec2(1, 0)).rgb)
         + 4. * texture(uLow, uv).rgb;
  fragColor = vec4(texture(uCur, uv).rgb * uW + s / 16. * uLowW, 1.);
}`

/** Exposure, film tone curve and grade, grain */
export const FINAL = `${PRELUDE}
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec4 uTone;      // exposure, bloom gain, saturation, grain
uniform vec3 uLift;      // added in the shadows (after the curve)
uniform vec3 uGain;      // highlights' tint
uniform vec4 uTone2;     // contrast, vignette, time, white point
uniform vec4 uFrame;     // the frame the look is set in: the canvas's offset in it, its size (px)
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texture(uScene, uv).rgb + texture(uBloom, uv).rgb * uTone.y;
  c *= uTone.x;
  c = aces(c / uTone2.w);
  c = pow(c, vec3(1. / 2.2));
  float l = dot(c, vec3(.2126, .7152, .0722));
  c = mix(vec3(l), c, uTone.z);
  c = (c - .5) * uTone2.x + .5;
  c = c * uGain * smoothstep(-.2, 1., l) + c * (1. - smoothstep(-.2, 1., l));
  c += uLift * (1. - l);
  vec2 vq = (gl_FragCoord.xy + uFrame.xy) / uFrame.zw - .5;
  c *= 1. - uTone2.y * dot(vq, vq) * 1.6;
  c += (hash12(gl_FragCoord.xy + fract(uTone2.z * 7.31) * 113.7) - .5) * uTone.w;
  // dither (triangular, one step of the screen's 8 bits): no banding in the dark gradients
  vec2 dq = gl_FragCoord.xy + fract(uTone2.z * 3.17) * 61.;
  c += (hash12(dq) + hash12(dq * 1.37 + 7.) - 1.) / 255.;
  fragColor = vec4(clamp(c, 0., 1.), 1.);
}`
