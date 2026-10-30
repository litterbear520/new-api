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
import type { Ctx, GroupRec, NodeRec } from './context'
import { h, now, reduced, translate } from './dom'
import { clamp, dispSize, LAY } from './geometry'
import { randomId } from './groups'
import { contentBounds, markRec, pub } from './query'
import type { ImagePatch, ImageSpec, PublicNode } from './types'

/* Pictures: added, changed, moved between frames, removed. */

export function createNodes(c: Ctx) {
  const d = c.d

  function placeNode(n: NodeRec) {
    const st = n.el.style
    st.transform = translate(n.ax, n.ay)
    if (n.sizedW !== n.dw) {
      st.width = `${n.dw}px`
      n.sizedW = n.dw
    }
    if (n.sizedH !== n.dh) {
      st.height = `${n.dh}px`
      n.sizedH = n.dh
    }
  }

  /** Re-flows a frame with the glide, then shows the selection again. */
  function reflow(g: GroupRec) {
    c.fx.flowing()
    c.fx.layoutGroup(g)
    c.fx.settle()
  }

  function newNode(id: string, spec: ImageSpec): NodeRec {
    const w = Math.max(1, Number(spec.w) || 1024)
    const hh = Math.max(1, Number(spec.h) || 1024)
    const [dw, dh] = dispSize(w, hh, spec.dw)
    const el = h('div', 'bd-cv-node')
    el.dataset.cvId = id
    const media = h('div', 'bd-cv-media')
    el.append(media)
    return {
      id,
      groupId: null,
      src: spec.src || null,
      thumb: spec.thumb || null,
      thumbW: 0,
      want: null,
      w,
      h: hh,
      dw,
      dh,
      label: spec.label || '',
      status: spec.status || (spec.src ? 'ready' : 'pending'),
      meta: { ...spec.meta },
      ax: 0,
      ay: 0,
      marks: (spec.marks ?? []).map((m, i) => markRec(m, i)),
      userSized: !!spec.dw,
      el,
      media,
      svg: null,
      imgEl: null,
      shown: null,
      tok: 0,
      slot: null,
      sizedW: -1,
      sizedH: -1,
      dead: false,
    }
  }

  function addImage(spec: ImageSpec): PublicNode {
    const id = spec.id != null ? String(spec.id) : randomId('i')
    const have = c.nodes.get(id)
    if (have) {
      updateImage(id, spec)
      return pub(have)
    }
    const n = newNode(id, spec)
    const g =
      spec.groupId != null ? c.groups.get(String(spec.groupId)) : undefined
    let autoPlaced = false
    if (g) {
      n.groupId = g.id
      const at =
        spec.index != null
          ? clamp(spec.index, 0, g.children.length)
          : g.children.length
      g.children.splice(at, 0, id)
    } else if (spec.x != null && spec.y != null) {
      n.ax = Number(spec.x)
      n.ay = Number(spec.y)
    } else {
      const b = contentBounds(c)
      if (b) {
        n.ax = b.x
        n.ay = b.y + b.h + LAY.groupGap
      }
      autoPlaced = true
    }
    c.nodes.set(id, n)
    d.nodesL.append(n.el)
    if (!c.restoring && !reduced()) {
      n.el.classList.add('is-new')
      window.setTimeout(() => n.el.classList.remove('is-new'), 600)
    }
    c.fx.renderMedia(n, false)
    if (n.marks.length) c.fx.renderMarks(n)
    if (g) {
      if (c.restoring) c.fx.layoutGroup(g)
      else reflow(g)
    } else {
      placeNode(n)
    }
    if (!c.restoring && c.o.autoFocus !== false) {
      const f = c.follow
      if (g && f && f.until > now() && f.ids.includes(g.id)) {
        c.fx.scheduleFocus()
      } else if (autoPlaced) {
        c.follow = { ids: [id], until: now() + 2000 }
        c.fx.scheduleFocus()
      }
    }
    c.fx.invalidate()
    c.fx.changed()
    return pub(n)
  }

  function moveToGroup(n: NodeRec, g: GroupRec | null, index?: number) {
    const og = n.groupId ? c.groups.get(n.groupId) : undefined
    if (og) {
      og.children = og.children.filter((x) => x !== n.id)
      c.fx.flowing()
      c.fx.layoutGroup(og)
    }
    n.groupId = g ? g.id : null
    if (g) {
      g.children.splice(index ?? g.children.length, 0, n.id)
      c.fx.flowing()
      c.fx.layoutGroup(g)
    } else {
      placeNode(n)
    }
    c.fx.settle()
  }

  function updateImage(id: string, patch: ImagePatch): PublicNode | null {
    const n = c.nodes.get(id)
    if (!n) return null
    const prev = n.status
    let relayout = false
    let rerender = false
    if (patch.label != null) {
      n.label = patch.label
      rerender = rerender || n.status !== 'ready'
      if (n.imgEl) n.imgEl.alt = n.label
    }
    if (patch.meta) n.meta = { ...n.meta, ...patch.meta }
    const newW = patch.w && patch.w !== n.w
    const newH = patch.h && patch.h !== n.h
    if (newW || newH) {
      n.w = patch.w || n.w
      n.h = patch.h || n.h
      ;[n.dw, n.dh] = dispSize(n.w, n.h, n.userSized ? n.dw : null)
      relayout = true
    }
    if (patch.dw) {
      ;[n.dw, n.dh] = dispSize(n.w, n.h, patch.dw)
      n.userSized = true
      relayout = true
    }
    if (patch.src !== undefined && patch.src !== n.src) {
      n.src = patch.src
      // Marks belong to the old picture.
      if (n.marks.length) {
        n.marks = []
        c.fx.renderMarks(n)
      }
      rerender = true
      if (!patch.status && n.src && n.status !== 'ready') n.status = 'ready'
    }
    if (patch.thumb !== undefined && patch.thumb !== n.thumb) {
      n.thumb = patch.thumb
      n.thumbW = 0
      rerender = rerender || !n.shown
    }
    if (patch.status && patch.status !== n.status) {
      n.status = patch.status
      rerender = true
    }
    if (rerender) c.fx.renderMedia(n, prev !== 'ready' && n.status === 'ready')
    const nextGroup = patch.groupId === undefined ? n.groupId : patch.groupId
    if ((nextGroup || null) !== n.groupId) {
      // An unknown frame leaves the picture on its own.
      moveToGroup(n, nextGroup ? (c.groups.get(nextGroup) ?? null) : null)
      relayout = false
    }
    if (patch.x != null && patch.y != null && !n.groupId) {
      n.ax = Number(patch.x)
      n.ay = Number(patch.y)
      placeNode(n)
    }
    if (relayout) {
      n.svg?.setAttribute('viewBox', `0 0 1000 ${(1000 * n.dh) / n.dw}`)
      const g = n.groupId ? c.groups.get(n.groupId) : undefined
      if (g) reflow(g)
      else placeNode(n)
      c.fx.keepFraming()
    }
    c.tbKey = ''
    if (c.tool === 'mark') c.fx.renderPanel()
    c.fx.invalidate()
    c.fx.changed()
    return pub(n)
  }

  function dropNode(n: NodeRec) {
    n.el.remove()
    n.dead = true
    c.nodes.delete(n.id)
  }

  function remove(id: string) {
    const n = c.nodes.get(id)
    const g = c.groups.get(id)
    if (n) {
      dropNode(n)
      const og = n.groupId ? c.groups.get(n.groupId) : undefined
      if (og) {
        og.children = og.children.filter((x) => x !== id)
        reflow(og)
      }
    } else if (g) {
      for (const cid of g.children) {
        const k = c.nodes.get(cid)
        if (!k) continue
        dropNode(k)
        c.sel.delete(cid)
      }
      g.el.remove()
      g.tEl.remove()
      c.groups.delete(id)
      c.gOrder = c.gOrder.filter((x) => x !== id)
    } else {
      return
    }
    if (c.sel.delete(id)) {
      c.tbKey = ''
      c.o.onSelect?.([...c.sel])
    }
    if (c.hoverId === id) c.hoverId = null
    if (c.hoverG === id) c.hoverG = null
    if (c.pick === id) c.fx.cancelPick()
    if (c.tool === 'mark') c.fx.renderPanel()
    c.fx.invalidate()
    c.fx.changed()
  }

  return { placeNode, addImage, updateImage, remove }
}
