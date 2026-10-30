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
/*
 * The bear, drawn on the logo's 24×24 grid (the A-3 block bear). Rects of the
 * same colour are merged into one path so no seams show. The viewBox
 * (-8 -9 40 31) leaves room around the body for props and effects. CSS in
 * bear.css animates it from the `data-act` attribute; nothing here moves.
 * The markup is static, so it is built once per variant as a string.
 */

type Rect = [number, number, number, number]

const R = (rects: Rect[]) =>
  rects.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h${-w}z`).join('')
const P = (cls: string, rects: Rect[]) =>
  `<path class="${cls}" d="${R(rects)}"/>`

const EL: [number, number] = [6.744, 10.525]
const ER: [number, number] = [17.255, 10.525]

const cross = ([cx, cy]: [number, number]) =>
  `<path d="${R([[cx - 1.2, cy - 0.32, 2.4, 0.64]])}" transform="rotate(45 ${cx} ${cy})"/>` +
  `<path d="${R([[cx - 1.2, cy - 0.32, 2.4, 0.64]])}" transform="rotate(-45 ${cx} ${cy})"/>`
const caret = ([cx, cy]: [number, number]) =>
  R([
    [cx - 1.25, cy - 0.05, 0.85, 0.8],
    [cx - 0.42, cy - 0.7, 0.85, 0.8],
    [cx + 0.42, cy - 0.05, 0.85, 0.8],
  ])

const NOTE1 = R([
  [0, 2.2, 1.9, 1.5],
  [1.25, -1.6, 0.65, 3.9],
  [1.9, -1.6, 1.3, 0.65],
  [2.55, -0.95, 0.65, 0.9],
])
const NOTE2 = R([
  [0, 2.2, 1.7, 1.4],
  [3, 1.6, 1.7, 1.4],
  [1.1, -1.4, 0.6, 3.7],
  [4.1, -2, 0.6, 3.7],
  [1.1, -2, 3.6, 0.8],
])
/** Pixel heart centred on (0,0), 0.8 per cell. */
const HEART = (() => {
  const rows = [
    '.##.##.',
    '#######',
    '#######',
    '.#####.',
    '..###..',
    '...#...',
  ]
  const c = 0.8
  const out: Rect[] = []
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '#') out.push([(x - 3.5) * c, (y - 3) * c, c + 0.02, c + 0.02])
    })
  )
  return R(out)
})()
const STAR = R([
  [-0.4, -1.6, 0.8, 0.8],
  [-1.6, -0.8, 3.2, 0.8],
  [-0.8, 0, 1.6, 0.8],
  [-1.2, 0.8, 0.8, 0.8],
  [0.4, 0.8, 0.8, 0.8],
])
const STEAM = 'M0 0q.9-.9 0-1.8t0-1.8'

const CALC_KEYS: Rect[] = [0, 1, 2]
  .flatMap((j) =>
    [0, 1, 2].map((i): Rect => [7.35 + i * 1.9, 16.2 + j * 1.35, 1.4, 0.9])
  )
  .filter((_, k) => k !== 8)

function build(boat: boolean, uid: string): string {
  const id = (name: string) => `${name}-${uid}`
  const boatTop = boat
    ? `<g class="p-boat">${P('boat-pole', [[-3.3, 3.2, 0.6, 14]])}${P('boat-lamp', [[-4.5, 1.6, 3, 3.4]])}${P('boat-lamp-top', [[-4, 0.9, 2, 0.7]])}</g>`
    : ''
  const hull = boat
    ? `<g class="p-hull">${P('hull', [
        [-5, 17.4, 34, 1.7],
        [-3.8, 19.1, 31.6, 1.4],
        [-2.4, 20.5, 28.8, 1.2],
      ])}${P('hull-hi', [[-5, 17.4, 34, 0.5]])}</g>`
    : ''
  return `<svg class="xb" viewBox="-8 -9 40 31" aria-hidden="true" focusable="false" data-act="idle">
<defs><linearGradient id="${id('g')}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#bfe8ff"/><stop offset="1" stop-color="#bfe8ff" stop-opacity="0"/></linearGradient>
<linearGradient id="${id('m')}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>
<clipPath id="${id('c')}"><path d="${R([
    [3, 6, 18, 12.08],
    [4.5, 17.8, 3, 3.2],
    [16.5, 17.8, 3, 3.2],
    [0, 11.95, 3.6, 3.1],
    [20.4, 11.95, 3.6, 3.1],
    [3, 4.5, 6, 1.8],
    [4.5, 3, 3, 1.5],
    [15, 4.5, 6, 1.8],
    [16.5, 3, 3, 1.5],
  ])}"/></clipPath>
<linearGradient id="${id('w')}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<g class="fx fx-think">${P('td td1', [[-1.4, 2.4, 1.4, 1.4]])}${P('td td2', [[-4, 0, 1.9, 1.9]])}${P('td td3', [[-7.2, -3.4, 2.5, 2.5]])}</g>
<g class="fx fx-meteor"><path class="met" d="M0 0l7 1.6" stroke="url(#${id('m')})" stroke-width=".5" stroke-linecap="round" fill="none"/></g>
<g class="fx fx-coinblock"><g class="qblk">${P('qb', [[9, -8.6, 6, 5.4]])}${P(
    'qb-e',
    [
      [9, -8.6, 6, 0.6],
      [9, -3.8, 6, 0.6],
      [9, -8.6, 0.6, 5.4],
      [14.4, -8.6, 0.6, 5.4],
    ]
  )}<text class="qb-t" x="12" y="-4.4">?</text></g></g>
${boatTop}
<g class="b-all">
<g class="b-leg b-leg-l">${P('c-body', [[4.5, 17.8, 3, 3.2]])}</g>
<g class="b-leg b-leg-r">${P('c-body', [[16.5, 17.8, 3, 3.2]])}</g>
<g class="b-arm b-arm-l">${P('c-body', [[0, 11.95, 3.6, 3.1]])}</g>
<g class="b-arm b-arm-r">${P('c-body', [[20.4, 11.95, 3.6, 3.1]])}</g>
<g class="b-ear b-ear-l">${P('c-body', [
    [3, 4.5, 6, 1.8],
    [4.5, 3, 3, 1.5],
  ])}${P('c-inner', [[4.5, 4.5, 3, 1.5]])}</g>
<g class="b-ear b-ear-r">${P('c-body', [
    [15, 4.5, 6, 1.8],
    [16.5, 3, 3, 1.5],
  ])}${P('c-inner', [[16.5, 4.5, 3, 1.5]])}</g>
${P('c-body', [[3, 6, 18, 12.08]])}
${P('b-tail c-cream', [[10.4, 14.2, 3.2, 2.6]])}
<g class="b-face">
${P('c-blush', [
  [4.9, 12.45, 2.1, 0.95],
  [17, 12.45, 2.1, 0.95],
])}
<g class="b-shy">${P('', [
    [4.6, 12.4, 0.5, 1.2],
    [5.6, 12.4, 0.5, 1.2],
    [6.6, 12.4, 0.5, 1.2],
    [17.1, 12.4, 0.5, 1.2],
    [18.1, 12.4, 0.5, 1.2],
    [19.1, 12.4, 0.5, 1.2],
  ])}</g>
${P('c-cream', [[9.75, 11.95, 4.5, 3.1]])}
${P('c-ink', [[10.875, 11.95, 2.25, 1.35]])}
${P('c-ink b-mouth', [[11.2, 13.5, 1.6, 1.25]])}
<g class="b-look"><g class="b-eyes">${P('c-ink eye-l', [[6, 9.1, 1.488, 2.85]])}${P('c-ink eye-r', [[16.51, 9.1, 1.49, 2.85]])}</g>
<g class="b-eyesh c-ink"><path d="${caret(EL)}"/><path d="${caret(ER)}"/></g>
<g class="b-eyesx c-ink">${cross(EL)}${cross(ER)}</g></g>
</g>
<path class="p-glow" d="${R([[3, 8.2, 18, 4.4]])}" fill="url(#${id('g')})"/>
<g class="p p-laptop">${P('lap', [[4.6, 12.5, 14.8, 6.2]])}${P('lap-logo', [
    [10.9, 14.9, 2.2, 1.5],
    [10.6, 14.4, 0.7, 0.7],
    [12.7, 14.4, 0.7, 0.7],
  ])}${P('lap-deck', [[2.4, 18.7, 19.2, 1.1]])}</g>
<g class="p p-pad">${P('pad', [[6, 14.4, 12, 5.8]])}${P('pad-l pl1', [[7.3, 15.9, 8.4, 0.55]])}${P('pad-l pl2', [[7.3, 17.3, 6.6, 0.55]])}${P('pad-l pl3', [[7.3, 18.7, 7.6, 0.55]])}
<g class="pencil"><g transform="rotate(32 0 0)">${P('pen-body', [[-0.6, -5.4, 1.2, 4.5]])}${P('pen-rub', [[-0.6, -6.2, 1.2, 0.8]])}${P('pen-tip', [[-0.6, -0.9, 1.2, 0.75]])}${P('c-ink', [[-0.25, -0.15, 0.5, 0.45]])}</g>${P('c-body', [[0.4, -5.4, 2.4, 2.1]])}</g></g>
<g class="p p-lens"><circle class="lens" cx="0" cy="0" r="2.5"/><path class="lens-h" d="${R([[1.55, 1.55, 1, 3.4]])}" transform="rotate(-45 2.05 3.25)"/>${P('c-body', [[2.7, 3.5, 2.3, 2]])}</g>
<g class="p p-mic">${P('mic-h', [[13.5, 12.1, 2.4, 2.4]])}${P('mic-g', [
    [13.9, 12.9, 1.6, 0.35],
    [13.9, 13.6, 1.6, 0.35],
  ])}${P('mic-s', [[14.25, 14.4, 0.9, 3.1]])}${P('c-body', [[13.4, 16.2, 2.6, 1.9]])}</g>
<g class="p p-scope"><g class="scope">${P('sc-eye', [[15.8, 9.3, 2.7, 2.5]])}${P(
    'sc-a',
    [
      [18.3, 8.9, 4.4, 3.3],
      [26.7, 7.9, 3.4, 5.3],
    ]
  )}${P('sc-b', [[22.5, 8.4, 4.4, 4.3]])}${P('sc-band', [
    [22.3, 8.4, 0.5, 4.3],
    [26.5, 7.9, 0.5, 5.3],
  ])}${P('sc-lens', [[29.9, 8.3, 0.8, 4.5]])}${P('c-body', [
    [19.4, 11.9, 2.6, 2],
    [24.4, 12.4, 2.6, 2],
  ])}</g></g>
<g class="p p-web">${P('win', [[4.4, 12.4, 15.2, 8]])}${P('win-bar', [[4.4, 12.4, 15.2, 1.5]])}<circle class="wd1" cx="5.4" cy="13.15" r=".36"/><circle class="wd2" cx="6.5" cy="13.15" r=".36"/><circle class="wd3" cx="7.6" cy="13.15" r=".36"/>
${P('wb wb1', [[5.3, 14.6, 13.4, 1.7]])}${P('wb wb2', [[5.3, 16.9, 4, 2.8]])}${P('wb wb3', [[10, 17, 8.6, 0.6]])}${P('wb wb4', [[10, 18.1, 6.8, 0.6]])}${P('wb wb5', [[10, 19.2, 7.6, 0.6]])}</g>
<g class="p p-book">${P('bk-cover', [[4.6, 13.1, 14.8, 7]])}${P('bk-page', [
    [5.3, 13.5, 6.5, 6.1],
    [12.2, 13.5, 6.5, 6.1],
  ])}${P('bk-spine', [[11.8, 13.3, 0.4, 6.5]])}
${P('bk-l', [
  [6.1, 14.7, 4.7, 0.45],
  [6.1, 15.8, 4, 0.45],
  [6.1, 16.9, 4.7, 0.45],
  [6.1, 18, 3.4, 0.45],
  [13, 14.7, 4.7, 0.45],
  [13, 15.8, 4.2, 0.45],
  [13, 16.9, 4.7, 0.45],
  [13, 18, 2.8, 0.45],
])}
<g class="bk-flip">${P('bk-page', [[12.2, 13.5, 6.5, 6.1]])}${P('bk-l', [
    [13, 14.7, 4.7, 0.45],
    [13, 15.8, 4.2, 0.45],
    [13, 16.9, 4.7, 0.45],
  ])}</g></g>
<g class="p p-calc">${P('ca-body', [[6.6, 13.1, 6.8, 7.3]])}${P('ca-scr', [[7.2, 13.7, 5.6, 1.9]])}<text class="ca-t" x="12.5" y="15.2">86.5</text>
${P('ca-k', CALC_KEYS)}${P('ca-eq', [[11.15, 18.9, 1.4, 0.9]])}</g>
<g class="p p-bell"><g class="bell">${P('be-dome', [
    [22.5, 2.2, 3.4, 2.7],
    [23.2, 1.5, 2, 0.8],
  ])}${P('be-rim', [[21.9, 4.8, 4.6, 0.75]])}${P('be-cl', [[23.8, 5.5, 0.8, 0.75]])}</g></g>
<g class="p p-phones">${P('ph-band', [
    [3.6, 1.3, 16.8, 1],
    [2.7, 1.7, 1, 6],
    [20.3, 1.7, 1, 6],
  ])}${P('ph-cup', [
    [1.4, 7.2, 3, 4.6],
    [19.6, 7.2, 3, 4.6],
  ])}${P('ph-pad', [
    [2.4, 7.7, 1.1, 3.6],
    [20.5, 7.7, 1.1, 3.6],
  ])}</g>
<g class="p p-mug"><g class="mug">${P('mug-b', [[8.6, 13.4, 6.2, 5.3]])}${P('mug-c', [[9.1, 13.6, 5.2, 0.9]])}${P('mug-s', [[8.6, 16.1, 6.2, 0.8]])}${P(
    'mug-b',
    [
      [14.8, 14.3, 1.6, 0.7],
      [15.7, 14.3, 0.7, 2.9],
      [14.8, 16.5, 1.6, 0.7],
    ]
  )}${P('c-body', [
    [7.1, 15, 1.9, 2.1],
    [15.1, 15.6, 1.9, 2.1],
  ])}</g></g>
<g class="p p-wand"><path class="wand-s" d="M23.6 6.2L27.9-1.6"/><g class="wand-t"><path class="wand-g" d="${STAR}" transform="translate(28.3 -2.2) scale(1.35)"/></g>${P('c-body', [[22.3, 5.3, 2.6, 2.2]])}</g>
<g class="p p-flag"><path class="fl-pole" d="${R([[23.3, -6.4, 0.6, 14]])}"/><g class="flag">${P('fl-a', [[23.9, -6.2, 5.6, 4.2]])}${P(
    'fl-b',
    [
      [23.9, -6.2, 1.4, 1.4],
      [26.7, -6.2, 1.4, 1.4],
      [25.3, -4.8, 1.4, 1.4],
      [28.1, -4.8, 1.4, 1.4],
      [23.9, -3.4, 1.4, 1.4],
      [26.7, -3.4, 1.4, 1.4],
    ]
  )}</g>${P('c-body', [[22.3, 5.3, 2.6, 2.2]])}</g>
<g class="b-shine" clip-path="url(#${id('c')})"><path class="shine" d="M0-2h3.4L-1.2 24h-3.4z" fill="url(#${id('w')})"/></g>
<g class="p p-rod"><path class="rod" d="M21.6 13.6L30.6-2.4"/><path class="rod-line" d="M30.6-2.4V19.4"/><g class="bob">${P('bob-t', [[30.1, 19.2, 1, 0.7]])}${P('bob-b', [[30.1, 19.9, 1, 0.7]])}</g>${P('c-body', [[20.6, 12.6, 2.4, 2]])}</g>
</g>
${hull}
<g class="fx fx-notes"><path class="nt nt1" d="${NOTE1}"/><path class="nt nt2" d="${NOTE2}"/><path class="nt nt3" d="${NOTE1}"/></g>
<g class="fx fx-zzz"><text class="zz zz1" x="22" y="5">z</text><text class="zz zz2" x="22" y="5">Z</text></g>
<g class="fx fx-code"><text class="cg cg1" x="20" y="11.5">&lt;/&gt;</text><text class="cg cg2" x="20" y="11.5">{ }</text><text class="cg cg3" x="20" y="11.5">;</text></g>
<g class="fx fx-math"><text class="mg mg1" x="14.5" y="12.5">+</text><text class="mg mg2" x="14.5" y="12.5">×</text><text class="mg mg3" x="14.5" y="12.5">=</text></g>
<g class="fx fx-spark">${P('sp sp1', [[-1.6, 2, 1, 1]])}${P('sp sp2', [[25, 1, 1.2, 1.2]])}${P('sp sp3', [[2, -3, 0.9, 0.9]])}${P('sp sp4', [[22.5, -4, 1, 1]])}</g>
<g class="fx fx-sweat">${P('sw', [
    [21.8, 5.4, 1.1, 1.5],
    [22.05, 4.8, 0.6, 0.7],
  ])}</g>
<g class="fx fx-bang">${P('bang', [
    [11.4, -6.4, 1.2, 3.6],
    [11.4, -2.2, 1.2, 1.2],
  ])}</g>
<g class="fx fx-hearts"><path class="ht ht1" d="${HEART}"/><path class="ht ht2" d="${HEART}"/><path class="ht ht3" d="${HEART}"/></g>
<g class="fx fx-bubbles"><g class="bub-l">${P('bu', [
    [-7.4, -4.6, 6.6, 5.2],
    [-2.4, 0.6, 1.2, 1],
  ])}<text class="bu-t" x="-4.1" y="-0.9">文</text></g><g class="bub-r">${P(
    'bu',
    [
      [24.8, -4.6, 6.6, 5.2],
      [25.2, 0.6, 1.2, 1],
    ]
  )}<text class="bu-t bu-a" x="28.1" y="-0.9">A</text></g></g>
<g class="fx fx-check"><circle class="ck" cx="27" cy="3.2" r="2.4"/><path class="ck-v" d="M25.9 3.2l.8.8 1.5-1.6"/></g>
<g class="fx fx-puffs">${P('pf pf1', [[0, 0, 1.4, 1.4]])}${P('pf pf2', [[0, 0, 1.1, 1.1]])}${P('pf pf3', [[0, 0, 1.2, 1.2]])}</g>
<g class="fx fx-coin"><g class="coin">${P('co-e', [[-1.6, -1.9, 3.2, 3.8]])}${P('co', [[-1.2, -1.6, 2.4, 3.2]])}${P('co-h', [[-0.5, -1.1, 0.5, 2.2]])}</g></g>
<g class="fx fx-steam"><path class="st st1" d="${STEAM}"/><path class="st st2" d="${STEAM}"/><path class="st st3" d="${STEAM}"/></g>
<g class="fx fx-catch"><path class="cstar" d="${STAR}"/></g>
<g class="fx fx-wish"><path class="wish" d="${STAR}"/></g>
</svg>`
}

let count = 0

/** A fresh copy of the bear's markup with ids unique to this copy. */
export function bearMarkup(opts: { boat?: boolean } = {}): string {
  count += 1
  return build(opts.boat === true, `xb${count}`)
}
