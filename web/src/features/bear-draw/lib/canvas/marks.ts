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
import type { Ctx, MarkGesture, NodeRec } from './context'
import { SVG_NS } from './dom'
import { clamp, finishStroke, pathD } from './geometry'
import { markNode, markRec, toWorld } from './query'
import type { Point, UV } from './types'

/*
 * 圈选: red free-hand strokes on a picture, numbered in order. They live in
 * an SVG inside the picture (viewBox 1000 wide), so they move and scale
 * with it; the stroke width is kept near 3 screen px through --bd-cv-sw.
 */
export function createMarks(c: Ctx) {
  function ensureSvg(n: NodeRec): SVGSVGElement {
    let svg = n.svg
    if (!svg) {
      svg = document.createElementNS(SVG_NS, 'svg')
      svg.setAttribute('class', 'bd-cv-marks')
      svg.setAttribute('preserveAspectRatio', 'none')
      svg.setAttribute('aria-hidden', 'true')
      n.el.append(svg)
      n.svg = svg
    }
    svg.setAttribute('viewBox', `0 0 1000 ${(1000 * n.dh) / n.dw}`)
    return svg
  }

  function renderMarks(n: NodeRec) {
    if (!n.marks.length && !n.svg) return
    const svg = ensureSvg(n)
    const vh = (1000 * n.dh) / n.dw
    svg.innerHTML = n.marks
      .map((m) => {
        const d = pathD(m.pts, m.closed, vh)
        const cls = m.closed ? 'bd-cv-mk is-closed' : 'bd-cv-mk'
        return `<path class="bd-cv-mk-halo" d="${d}"/><path class="${cls}" d="${d}"/>`
      })
      .join('')
    c.fx.invalidate()
  }

  function svgPath(cls: string): SVGPathElement {
    const p = document.createElementNS(SVG_NS, 'path')
    p.setAttribute('class', cls)
    return p
  }

  function uv(n: NodeRec, pt: Point): UV {
    const p = toWorld(c, pt)
    return [clamp((p.x - n.ax) / n.dw, 0, 1), clamp((p.y - n.ay) / n.dh, 0, 1)]
  }

  function startMark(n: NodeRec, pt: Point) {
    if (!c.sel.has(n.id) || c.sel.size !== 1) c.fx.setSel([n.id], true)
    const svg = ensureSvg(n)
    const halo = svgPath('bd-cv-mk-halo')
    const path = svgPath('bd-cv-mk')
    svg.append(halo, path)
    c.G = { type: 'mark', n, pts: [uv(n, pt)], last: pt, path, halo }
    c.fx.invalidate()
  }

  function markMove(G: MarkGesture, pt: Point) {
    if (Math.hypot(pt.x - G.last.x, pt.y - G.last.y) < 2) return
    G.last = pt
    G.pts.push(uv(G.n, pt))
    const d = pathD(G.pts, false, (1000 * G.n.dh) / G.n.dw)
    G.path.setAttribute('d', d)
    G.halo.setAttribute('d', d)
  }

  function markEnd(G: MarkGesture) {
    const n = G.n
    G.path.remove()
    G.halo.remove()
    const stroke = finishStroke(G.pts, n.dw, n.dh, c.cam.s)
    if (!stroke) {
      renderMarks(n)
      return
    }
    n.marks.push(markRec(stroke, n.marks.length))
    renderMarks(n)
    c.fx.renderPanel()
    c.fx.changed()
  }

  /** Clears the marks of a picture (default: the one being marked). */
  function clearMarks(id?: string) {
    const n = id == null ? markNode(c) : (c.nodes.get(String(id)) ?? null)
    if (!n) return
    n.marks = []
    renderMarks(n)
    if (c.tool === 'mark') c.fx.renderPanel()
    c.fx.changed()
  }

  return { renderMarks, startMark, markMove, markEnd, clearMarks }
}
