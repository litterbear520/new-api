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
import type { Ctx } from './context'
import { clamp, MAX_S, MIN_S } from './geometry'
import type { CanvasState, CanvasStateInput, ImageSpec } from './types'

/* The whole canvas as plain data, and back (restoring is silent). */

function parseState(json: string): CanvasStateInput | null {
  try {
    const raw: unknown = JSON.parse(json)
    return raw && typeof raw === 'object' ? (raw as CanvasStateInput) : null
  } catch {
    return null
  }
}

export function createStateIo(c: Ctx) {
  function getState(): CanvasState {
    return {
      v: 1,
      camera: { ...c.cam },
      fitted: c.fitTarget != null,
      groups: c.gOrder.flatMap((id) => {
        const g = c.groups.get(id)
        if (!g) return []
        const { title, subtitle, x, y } = g
        return [{ id, title, subtitle, x, y, children: [...g.children] }]
      }),
      images: [...c.nodes.values()].map((n) => ({
        id: n.id,
        groupId: n.groupId,
        src: n.src,
        w: n.w,
        h: n.h,
        dw: n.userSized ? n.dw : undefined,
        label: n.label,
        status: n.status,
        meta: { ...n.meta },
        x: n.groupId ? undefined : n.ax,
        y: n.groupId ? undefined : n.ay,
        marks: n.marks.map((m) => ({
          pts: m.pts.map(([u, v]): [number, number] => [u, v]),
          closed: m.closed,
          note: m.note,
        })),
      })),
    }
  }

  function clearAll() {
    for (const n of c.nodes.values()) {
      n.el.remove()
      n.dead = true
    }
    for (const g of c.groups.values()) {
      g.el.remove()
      g.tEl.remove()
    }
    c.nodes.clear()
    c.groups.clear()
    c.gOrder = []
    c.sel = new Set()
    c.hoverId = null
    c.hoverG = null
    c.tbKey = ''
  }

  /** Each frame is filled before the next one is placed below it. */
  function restore(st: CanvasStateInput) {
    const byId = new Map<string, ImageSpec & { id: string }>()
    for (const n of st.images ?? []) byId.set(String(n.id), n)
    for (const g of st.groups ?? []) {
      const { id, title, subtitle, x, y } = g
      c.fx.addGroup({ id, title, subtitle, x, y })
      for (const cid of g.children ?? []) {
        const n = byId.get(String(cid))
        if (!n) continue
        c.fx.addImage({ ...n, groupId: id, index: undefined })
        byId.delete(String(cid))
      }
    }
    for (const n of byId.values()) {
      const inGroup = n.groupId != null && c.groups.has(String(n.groupId))
      c.fx.addImage({ ...n, groupId: inGroup ? n.groupId : null })
    }
  }

  function setState(input: CanvasStateInput | string) {
    const st = typeof input === 'string' ? parseState(input) : input
    if (!st) return
    c.fx.closeCompare(true)
    c.fx.closeMenu()
    c.G = null
    c.follow = null
    window.clearTimeout(c.timers.focus)
    c.restoring = true
    try {
      clearAll()
      restore(st)
    } finally {
      c.restoring = false
    }
    if (st.camera) {
      c.fx.stopCam()
      c.fitTarget = null
      c.cam.x = Number(st.camera.x) || 0
      c.cam.y = Number(st.camera.y) || 0
      c.cam.s = clamp(Number(st.camera.s) || 1, MIN_S, MAX_S)
      c.camInit = true
    }
    if (c.tool === 'mark') c.fx.renderPanel()
    c.fx.invalidate()
  }

  return { getState, setState }
}
