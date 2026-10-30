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
import type { Ctx, GroupRec, LayoutPlan, NodeRec } from './context'
import { esc, h, now, translate } from './dom'
import { flow, LAY } from './geometry'
import { contentBounds, pubG } from './query'
import type { GroupPatch, GroupSpec, PublicGroup } from './types'

/* Frames: one set of pictures each, laid out in rows (see flow). */

export const randomId = (prefix: string) =>
  `${prefix}${Math.random().toString(36).slice(2, 8)}`

export function createGroups(c: Ctx) {
  const d = c.d

  function placeFrame(g: GroupRec) {
    const st = g.el.style
    st.transform = translate(g.x, g.y)
    st.width = `${g.w}px`
    st.height = `${g.h}px`
  }

  function setTitle(g: GroupRec) {
    const name = `<span class="bd-cv-gt-name">${esc(g.title || c.L.untitled)}</span>`
    const sub = g.subtitle
      ? `<span class="bd-cv-gt-sub">${esc(g.subtitle)}</span>`
      : ''
    g.tEl.innerHTML = name + sub
  }

  /** Places the frame's pictures; `plan` makes room while dragging. */
  function layoutGroup(g: GroupRec, plan?: LayoutPlan) {
    const ids = g.children.filter((id) => !plan?.exclude?.has(id))
    if (plan?.insert) ids.splice(plan.insert.index, 0, ...plan.insert.ids)
    const list = ids
      .map((id) => c.nodes.get(id))
      .filter((n): n is NodeRec => !!n)
    const r = flow(list.map((n) => ({ w: n.dw, h: n.dh })))
    g.w = r.w
    g.h = r.h
    list.forEach((n, i) => {
      const p = r.pos[i]
      if (plan?.skip?.has(n.id)) {
        n.slot = { x: g.x + p.x, y: g.y + p.y }
        return
      }
      n.slot = null
      n.ax = g.x + p.x
      n.ay = g.y + p.y
      c.fx.placeNode(n)
    })
    placeFrame(g)
  }

  function addGroup(spec: GroupSpec): PublicGroup {
    const id = spec.id != null ? String(spec.id) : randomId('g')
    const have = c.groups.get(id)
    if (have) {
      updateGroup(id, spec)
      return pubG(have)
    }
    const el = h('div', 'bd-cv-frame')
    el.dataset.cvGroup = id
    const tEl = h('div', 'bd-cv-gt')
    tEl.dataset.cvTitle = id
    const g: GroupRec = {
      id,
      title: spec.title || '',
      subtitle: spec.subtitle || '',
      x: 0,
      y: 0,
      w: LAY.emptyW,
      h: LAY.emptyH,
      children: [],
      el,
      tEl,
    }
    if (spec.x != null && spec.y != null) {
      g.x = Number(spec.x)
      g.y = Number(spec.y)
    } else {
      // Below everything, lined up with the first frame.
      const b = contentBounds(c)
      const first = c.groups.get(c.gOrder[0] ?? '')
      if (b) {
        g.x = first ? first.x : b.x
        g.y = b.y + b.h + LAY.groupGap
      }
    }
    setTitle(g)
    d.framesL.append(el)
    d.titlesL.append(tEl)
    c.groups.set(id, g)
    c.gOrder.push(id)
    layoutGroup(g)
    if (!c.restoring && c.o.autoFocus !== false) {
      c.follow = { ids: [id], until: now() + 2000 }
      c.fx.scheduleFocus()
    }
    c.fx.invalidate()
    c.fx.changed()
    return pubG(g)
  }

  function updateGroup(id: string, patch: GroupPatch) {
    const g = c.groups.get(id)
    if (!g) return
    if (patch.title != null) g.title = patch.title
    if (patch.subtitle != null) g.subtitle = patch.subtitle
    if (c.renaming?.g !== g) setTitle(g)
    if (patch.x != null && patch.y != null) {
      g.x = Number(patch.x)
      g.y = Number(patch.y)
      layoutGroup(g)
    }
    c.fx.invalidate()
    c.fx.changed()
  }

  return { placeFrame, setTitle, layoutGroup, addGroup, updateGroup }
}
