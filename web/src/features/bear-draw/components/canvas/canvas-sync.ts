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
import type {
  CanvasApi,
  CanvasMeta,
  CanvasState,
  CanvasStateInput,
  GroupPatch,
  ImagePatch,
  ImageSpec,
  NodeStatus,
  PublicNode,
} from '../../lib/canvas/types'
import type {
  CanvasCamera,
  CanvasGroup,
  CanvasNode,
  Project,
} from '../../types'

/*
 * The project is the source of truth for what is on the canvas; the canvas
 * owns where things are. Picture state (status, picture, label, size) is
 * pushed whenever the canvas differs; positions only when the project
 * changed them, so a move the user just made is not undone before it is
 * saved back (applyCanvasState).
 */

/** The picture's object URL, or null while it isn't loaded. */
export type SrcOf = (n: CanvasNode) => string | null

const noThumb: SrcOf = () => null

/** A finished picture waits as 'pending' until its URL is known. */
export function canvasStatus(n: CanvasNode, src: string | null): NodeStatus {
  if (n.status === 'failed' || n.status === 'stopped') return 'failed'
  return n.status === 'ready' && src ? 'ready' : 'pending'
}

function imageSpec(
  n: CanvasNode,
  src: string | null,
  thumb: string | null,
  index?: number
): ImageSpec & { id: string } {
  const status = canvasStatus(n, src)
  return {
    id: n.id,
    groupId: n.groupId,
    index,
    w: n.w,
    h: n.h,
    dw: n.dw,
    x: n.x,
    y: n.y,
    label: n.label,
    status,
    src: status === 'ready' ? src : null,
    thumb: status === 'ready' ? thumb : null,
    meta: n.meta,
  }
}

/** `thumbOf` gives the small copies the canvas shows while zoomed out. */
export function projectToState(
  p: Project,
  srcOf: SrcOf,
  thumbOf: SrcOf = noThumb
): CanvasStateInput {
  return {
    camera: p.camera ?? null,
    groups: p.groups.map((g) => ({
      id: g.id,
      title: g.title,
      subtitle: g.subtitle ?? '',
      x: g.x,
      y: g.y,
      children: [...g.children],
    })),
    images: p.nodes.map((n) => imageSpec(n, srcOf(n), thumbOf(n))),
  }
}

/** After the last of its project siblings that the canvas already shows. */
function insertIndex(
  cv: CanvasApi,
  groups: CanvasGroup[],
  n: CanvasNode
): number | undefined {
  const g = groups.find((x) => x.id === n.groupId)
  const k = g ? g.children.indexOf(n.id) : -1
  const shown = g ? cv.getNode(g.id) : null
  if (!g || k < 0 || shown?.type !== 'group') return undefined
  const before = new Set(g.children.slice(0, k))
  let at = 0
  shown.children.forEach((id, i) => {
    if (before.has(id)) at = i + 1
  })
  return at
}

function sameMeta(a: CanvasMeta, b: CanvasNode['meta']): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if (Reflect.get(a, k) !== Reflect.get(b, k)) return false
  }
  return true
}

function nodePatch(
  cur: PublicNode,
  was: CanvasNode | undefined,
  n: CanvasNode,
  src: string | null,
  thumb: string | null
): ImagePatch | null {
  const patch: ImagePatch = {}
  const status = canvasStatus(n, src)
  const wantSrc = status === 'ready' ? src : null
  const wantThumb = status === 'ready' ? thumb : null
  if (cur.status !== status) patch.status = status
  if (cur.src !== wantSrc) patch.src = wantSrc
  if (cur.thumb !== wantThumb) patch.thumb = wantThumb
  if (cur.label !== n.label) patch.label = n.label
  if (!sameMeta(cur.meta, n.meta)) {
    // The canvas merges meta; keys the project dropped are cleared.
    const cleared = Object.fromEntries(
      Object.keys(cur.meta).map((k) => [k, undefined])
    )
    patch.meta = { ...cleared, ...n.meta }
  }
  if (cur.w !== n.w || cur.h !== n.h) {
    patch.w = n.w
    patch.h = n.h
  }
  if (was && was.groupId !== n.groupId && cur.groupId !== n.groupId) {
    patch.groupId = n.groupId
  }
  const moved = was && (was.x !== n.x || was.y !== n.y)
  const placed = !n.groupId && n.x != null && n.y != null
  if (moved && placed && (cur.x !== n.x || cur.y !== n.y)) {
    patch.x = n.x
    patch.y = n.y
  }
  if (was && n.dw && was.dw !== n.dw && cur.dw !== n.dw) patch.dw = n.dw
  return Object.keys(patch).length ? patch : null
}

function syncGroup(
  cv: CanvasApi,
  was: CanvasGroup | undefined,
  g: CanvasGroup
) {
  const cur = cv.getNode(g.id)
  const subtitle = g.subtitle ?? ''
  if (cur?.type !== 'group') {
    cv.addGroup({ id: g.id, title: g.title, subtitle, x: g.x, y: g.y })
    return
  }
  const patch: GroupPatch = {}
  if (cur.title !== g.title) patch.title = g.title
  if (cur.subtitle !== subtitle) patch.subtitle = subtitle
  const moved = !was || was.x !== g.x || was.y !== g.y
  const placed = g.x != null && g.y != null
  if (moved && placed && (cur.x !== g.x || cur.y !== g.y)) {
    patch.x = g.x
    patch.y = g.y
  }
  if (Object.keys(patch).length) cv.updateGroup(g.id, patch)
}

/**
 * Brings the canvas in line with `next` (`prev` is the project last
 * applied). Returns the ids of the pictures it added.
 */
export function syncCanvas(
  cv: CanvasApi,
  prev: Project,
  next: Project,
  srcOf: SrcOf,
  thumbOf: SrcOf = noThumb
): string[] {
  const keep = new Set([
    ...next.groups.map((g) => g.id),
    ...next.nodes.map((n) => n.id),
  ])
  const shown = cv.getState()
  for (const n of shown.images) if (!keep.has(n.id)) cv.remove(n.id)
  for (const g of shown.groups) if (!keep.has(g.id)) cv.remove(g.id)

  const added: string[] = []
  const add = (n: CanvasNode) => {
    cv.addImage(
      imageSpec(n, srcOf(n), thumbOf(n), insertIndex(cv, next.groups, n))
    )
    added.push(n.id)
  }
  const isShown = (id: string) => cv.getNode(id)?.type === 'image'
  // A new frame gets its pictures before the next new frame goes below it.
  const groupsBefore = new Map(prev.groups.map((g) => [g.id, g]))
  const byId = new Map(next.nodes.map((n) => [n.id, n]))
  for (const g of next.groups) {
    syncGroup(cv, groupsBefore.get(g.id), g)
    for (const id of g.children) {
      const n = byId.get(id)
      if (n?.groupId === g.id && !isShown(id)) add(n)
    }
  }

  const nodesBefore = new Map(prev.nodes.map((n) => [n.id, n]))
  for (const n of next.nodes) {
    const cur = cv.getNode(n.id)
    if (cur?.type !== 'image') {
      add(n)
      continue
    }
    const patch = nodePatch(cur, nodesBefore.get(n.id), n, srcOf(n), thumbOf(n))
    if (patch) cv.updateImage(n.id, patch)
  }
  return added
}

const sameCamera = (a: CanvasCamera | null, b: CanvasCamera | null) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.s === b.s)

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])

/**
 * The project with the canvas's camera (once the user moved it), frame
 * positions and order, picture frames, positions and widths. The same project when nothing changed.
 * `updatedAt` is left alone: moving things around is not an edit.
 */
export function applyCanvasState(p: Project, st: CanvasState): Project {
  // A camera that only followed fits isn't kept: the next visit fits again.
  const camera = st.fitted ? null : { ...st.camera }
  let changed = !sameCamera(p.camera ?? null, camera)
  const shown = new Set(st.images.map((n) => n.id))
  const inProject = new Set(p.nodes.map((n) => n.id))
  const frames = new Map(st.groups.map((g) => [g.id, g]))
  const groups = p.groups.map((g) => {
    const s = frames.get(g.id)
    if (!s) return g
    // Pictures the canvas doesn't show yet keep their place at the end.
    const children = [
      ...s.children.filter((id) => inProject.has(id)),
      ...g.children.filter((id) => !shown.has(id)),
    ]
    if (g.x === s.x && g.y === s.y && sameList(children, g.children)) return g
    changed = true
    // "5 · 淘宝" counts the pictures in the frame
    const subtitle = g.subtitle?.replace(/\d+/, String(children.length))
    return { ...g, x: s.x, y: s.y, children, subtitle }
  })
  const pictures = new Map(st.images.map((n) => [n.id, n]))
  const nodes = p.nodes.map((n) => {
    const s = pictures.get(n.id)
    if (!s) return n
    const groupId = s.groupId
    const x = groupId ? n.x : s.x
    const y = groupId ? n.y : s.y
    const dw = s.dw ?? n.dw
    if (groupId === n.groupId && x === n.x && y === n.y && dw === n.dw) return n
    changed = true
    return { ...n, groupId, x, y, dw }
  })
  if (!changed) return p
  return { ...p, camera, groups, nodes }
}
