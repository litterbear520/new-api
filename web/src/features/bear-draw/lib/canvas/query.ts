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
import type { Ctx, GroupRec, MarkRec, NodeRec } from './context'
import { markAnchor, union } from './geometry'
import type {
  MarkState,
  Point,
  PublicGroup,
  PublicNode,
  Rect,
  SelectionKind,
} from './types'

/* Read-only questions about the canvas state (no side effects). */

export const toWorld = (c: Ctx, p: Point): Point => ({
  x: (p.x - c.cam.x) / c.cam.s,
  y: (p.y - c.cam.y) / c.cam.s,
})

export const local = (
  c: Ctx,
  e: { clientX: number; clientY: number }
): Point => ({ x: e.clientX - c.rect.left, y: e.clientY - c.rect.top })

export function measure(c: Ctx) {
  const r = c.d.el.getBoundingClientRect()
  c.rect = { left: r.left, top: r.top }
}

/** World box → screen box. */
export const sRect = (c: Ctx, x: number, y: number, w: number, h: number) => ({
  x: x * c.cam.s + c.cam.x,
  y: y * c.cam.s + c.cam.y,
  w: w * c.cam.s,
  h: h * c.cam.s,
})
export const nRect = (c: Ctx, n: NodeRec) => sRect(c, n.ax, n.ay, n.dw, n.dh)
export const gRect = (c: Ctx, g: GroupRec) => sRect(c, g.x, g.y, g.w, g.h)

/** The part of the world on screen. */
export const viewWorld = (c: Ctx): Rect => ({
  x: -c.cam.x / c.cam.s,
  y: -c.cam.y / c.cam.s,
  w: c.W / c.cam.s,
  h: c.H / c.cam.s,
})

export const firstOf = <T>(set: Set<T>): T | undefined =>
  set.values().next().value

export function selKind(c: Ctx): SelectionKind | null {
  if (!c.sel.size) return null
  const f = firstOf(c.sel)
  if (f != null && c.groups.has(f)) return 'group'
  return c.sel.size === 1 ? 'image' : 'multi'
}

export function selNode(c: Ctx): NodeRec | null {
  if (selKind(c) !== 'image') return null
  return c.nodes.get(firstOf(c.sel) ?? '') ?? null
}

/** The picture the 圈选 tool works on: one selected, finished picture. */
export function markNode(c: Ctx): NodeRec | null {
  const n = selNode(c)
  return n && n.status === 'ready' ? n : null
}

export function markRec(m: MarkState, i: number): MarkRec {
  const pts = m.pts.map(([u, v]): [number, number] => [Number(u), Number(v)])
  const [ax, ay] = markAnchor(pts)
  return { n: i + 1, pts, closed: !!m.closed, note: m.note || '', ax, ay }
}

export function pub(n: NodeRec): PublicNode {
  return {
    type: 'image',
    id: n.id,
    groupId: n.groupId,
    src: n.src,
    thumb: n.thumb,
    w: n.w,
    h: n.h,
    dw: n.dw,
    dh: n.dh,
    label: n.label,
    status: n.status,
    meta: { ...n.meta },
    x: n.ax,
    y: n.ay,
    marks: n.marks.map((m) => ({
      n: m.n,
      note: m.note,
      closed: m.closed,
      points: m.pts.map(([u, v]): [number, number] => [
        Math.round(u * n.w),
        Math.round(v * n.h),
      ]),
    })),
  }
}

export const pubG = (g: GroupRec): PublicGroup => ({
  type: 'group',
  id: g.id,
  title: g.title,
  subtitle: g.subtitle,
  x: g.x,
  y: g.y,
  w: g.w,
  h: g.h,
  children: [...g.children],
})

/** Public copies of the pictures with these ids (unknown ids skipped). */
export const pubNodes = (c: Ctx, ids: string[]): PublicNode[] =>
  ids.flatMap((id) => {
    const n = c.nodes.get(id)
    return n ? [pub(n)] : []
  })

const frameRect = (g: GroupRec): Rect => ({ x: g.x, y: g.y, w: g.w, h: g.h })

/** Everything on the canvas: frames and the pictures outside them. */
export function contentBounds(c: Ctx, skip?: string): Rect | null {
  let r: Rect | null = null
  for (const g of c.groups.values()) r = union(r, frameRect(g))
  for (const n of c.nodes.values()) {
    if (n.groupId || n.id === skip) continue
    r = union(r, { x: n.ax, y: n.ay, w: n.dw, h: n.dh })
  }
  return r
}

export function boundsOf(c: Ctx, ids: string[]): Rect | null {
  let r: Rect | null = null
  for (const id of ids) {
    const g = c.groups.get(id)
    const n = c.nodes.get(id)
    if (g) r = union(r, frameRect(g))
    else if (n) r = union(r, { x: n.ax, y: n.ay, w: n.dw, h: n.dh })
  }
  return r
}
