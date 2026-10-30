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
import type { Pool } from './dom'
import type { CanvasLabels } from './labels'
import type {
  ActionPayload,
  Camera,
  CanvasMeta,
  CanvasOptions,
  CanvasState,
  CanvasStateInput,
  CanvasTheme,
  FocusOptions,
  GroupPatch,
  GroupSpec,
  ImagePatch,
  ImageSpec,
  MenuItem,
  NodeStatus,
  Point,
  PublicGroup,
  PublicNode,
  Rect,
  Tool,
  UV,
} from './types'

/*
 * Internal state of one canvas. The modules (view, nodes, pointer, marks…)
 * share this context; calls between modules go through `fx`, filled by
 * createCanvas, so the modules never import each other.
 */

export type MarkRec = {
  n: number
  pts: UV[]
  closed: boolean
  note: string
  /** Badge position (0–1). */
  ax: number
  ay: number
}

export type NodeRec = {
  id: string
  groupId: string | null
  src: string | null
  thumb: string | null
  /** Width of the decoded thumbnail (0 until it has shown). */
  thumbW: number
  /** The src being decoded to replace what is shown. */
  want: string | null
  w: number
  h: number
  dw: number
  dh: number
  label: string
  status: NodeStatus
  meta: CanvasMeta
  /** World position. */
  ax: number
  ay: number
  marks: MarkRec[]
  userSized: boolean
  el: HTMLDivElement
  media: HTMLDivElement
  svg: SVGSVGElement | null
  imgEl: HTMLImageElement | null
  /** The src now on screen. */
  shown: string | null
  /** Bumps on every render so late image decodes are dropped. */
  tok: number
  /** Where it lands in its frame while being dragged. */
  slot: Point | null
  /** Width and height last written to the element. */
  sizedW: number
  sizedH: number
  dead: boolean
}

export type GroupRec = {
  id: string
  title: string
  subtitle: string
  x: number
  y: number
  w: number
  h: number
  children: string[]
  el: HTMLDivElement
  tEl: HTMLDivElement
}

/** While dragging: siblings make room for the dragged pictures. */
export type LayoutPlan = {
  exclude?: Set<string>
  skip?: Set<string>
  insert?: { index: number; ids: string[] } | null
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

export type PanGesture = { type: 'pan'; last: Point }
export type TapGesture = {
  type: 'tap'
  start: Point
  last: Point
  node: NodeRec | null
  moved: boolean
}
export type MarqueeGesture = {
  type: 'marquee'
  start: Point
  base: Set<string>
  moved: boolean
}
export type DragGesture = {
  type: 'drag'
  start: Point
  ids: string[]
  set: Set<string>
  primary: string
  orig: Map<string, Point>
  started: boolean
  /** Click on one of several selected: select only it if it doesn't move. */
  collapse: string | null
  target: GroupRec | null
  index: number
  touched: Set<string>
}
export type GroupDragGesture = {
  type: 'gdrag'
  g: GroupRec
  start: Point
  ox: number
  oy: number
  moved: boolean
  kids: Array<[NodeRec, number, number]>
}
export type ResizeGesture = {
  type: 'resize'
  n: NodeRec
  corner: Corner
  /** The fixed corner (world). */
  ax: number
  ay: number
  ratio: number
}
export type MarkGesture = {
  type: 'mark'
  n: NodeRec
  pts: UV[]
  last: Point
  path: SVGPathElement
  halo: SVGPathElement
}
export type PinchGesture = { type: 'pinch'; d0: number; s0: number; wm: Point }
export type Gesture =
  | PanGesture
  | TapGesture
  | MarqueeGesture
  | DragGesture
  | GroupDragGesture
  | ResizeGesture
  | MarkGesture
  | PinchGesture

export type CompareState = {
  el: HTMLDivElement
  A: NodeRec
  B: NodeRec
  same: boolean
  mode: 'slide' | 'side'
  p: number
}

export type MenuAt = {
  x: number
  y: number
  align?: 'center' | 'right'
  above?: boolean
}

export type Dom = {
  root: HTMLElement
  el: HTMLDivElement
  grid: HTMLDivElement
  world: HTMLDivElement
  framesL: HTMLDivElement
  nodesL: HTMLDivElement
  titlesL: HTMLDivElement
  hov: HTMLDivElement
  hovLabel: HTMLDivElement
  selL: HTMLDivElement
  mq: HTMLDivElement
  sizeL: HTMLDivElement
  tb: HTMLDivElement
  unionBox: HTMLDivElement
  handles: HTMLDivElement[]
  ui: HTMLDivElement
  tools: HTMLDivElement
  toolBtns: HTMLButtonElement[]
  uploadBtn: HTMLButtonElement
  miniBtn: HTMLButtonElement
  zoomBtn: HTMLButtonElement
  zoomPct: HTMLSpanElement
  miniBox: HTMLDivElement
  miniCv: HTMLCanvasElement
  panel: HTMLDivElement
  toastEl: HTMLDivElement
  dropEl: HTMLDivElement
  dropTxt: HTMLSpanElement
  probe: HTMLSpanElement
  boxPool: Pool
  badgePool: Pool
  ghostPool: Pool
}

/** Functions one module offers the others (see createCanvas). */
export type Fx = {
  invalidate: () => void
  frame: () => void
  moving: () => void
  flowing: () => void
  settle: () => void
  changed: () => void
  toast: (message: string, ms?: number) => void
  hideToast: () => void
  setSel: (ids: string[] | string | null, user: boolean) => void
  setTool: (tool: Tool) => void
  placeNode: (n: NodeRec) => void
  placeFrame: (g: GroupRec) => void
  setTitle: (g: GroupRec) => void
  layoutGroup: (g: GroupRec, plan?: LayoutPlan) => void
  renderMedia: (n: NodeRec, reveal: boolean) => void
  addGroup: (spec: GroupSpec) => PublicGroup
  updateGroup: (id: string, patch: GroupPatch) => void
  addImage: (spec: ImageSpec) => PublicNode
  updateImage: (id: string, patch: ImagePatch) => PublicNode | null
  remove: (id: string) => void
  stopCam: () => void
  zoomAt: (px: number, py: number, scale: number) => void
  animateCam: (to: Camera, duration?: number) => void
  focus: (target: string[] | string | null, opt?: FocusOptions) => void
  scheduleFocus: () => void
  sharpen: () => void
  keepFraming: () => void
  zoomTo: (scale: number, opt?: { animate?: boolean }) => void
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
  startDrag: (n: NodeRec, pt: Point, collapse: string | null) => void
  dragMove: (g: DragGesture, pt: Point) => void
  dragEnd: (g: DragGesture) => void
  startResize: (corner: Corner) => void
  resizeMove: (g: ResizeGesture, pt: Point) => void
  marqueeMove: (g: MarqueeGesture, pt: Point) => void
  renderMarks: (n: NodeRec) => void
  startMark: (n: NodeRec, pt: Point) => void
  markMove: (g: MarkGesture, pt: Point) => void
  markEnd: (g: MarkGesture) => void
  clearMarks: (id?: string) => void
  renderPanel: () => void
  act: (id: string, extra?: Partial<ActionPayload>) => void
  startPick: (id: string) => void
  cancelPick: () => void
  closeMenu: () => void
  openMenu: (
    items: MenuItem[],
    at: MenuAt,
    head?: HTMLElement | null,
    key?: string
  ) => void
  openMore: (p: ActionPayload) => void
  onContextMenu: (e: MouseEvent) => void
  startRename: (gid: string) => void
  commitRename: () => void
  compare: (a: string, b: string) => void
  closeCompare: (instant?: boolean) => void
  renderCompare: () => void
  nudgeCompare: (delta: number) => void
  setMini: (on: boolean) => void
  drawMini: () => void
  readColors: () => void
  getState: () => CanvasState
  setState: (state: CanvasStateInput | string) => void
  applyTheme: (theme: CanvasTheme) => void
}

export type Ctx = {
  o: CanvasOptions
  L: CanvasLabels
  d: Dom
  groups: Map<string, GroupRec>
  nodes: Map<string, NodeRec>
  gOrder: string[]
  cam: Camera
  /** Canvas size in px. */
  W: number
  H: number
  /** Canvas position on the page. */
  rect: { left: number; top: number }
  sel: Set<string>
  tool: Tool
  G: Gesture | null
  hoverId: string | null
  hoverG: string | null
  /** Picked for 对比; the next picture clicked is compared with it. */
  pick: string | null
  raf: number
  camAnim: number
  timers: {
    mov: number
    ch: number
    flow: number
    toast: number
    focus: number
    settle: number
  }
  /** New frames pull the camera along for a moment. */
  follow: { ids: string[]; until: number } | null
  /**
   * What the camera was last fitted to ('all' or ids). The camera fits it
   * again whenever the canvas changes size, until the user moves it.
   */
  fitTarget: string[] | 'all' | null
  settleUntil: number
  camInit: boolean
  restoring: boolean
  alive: boolean
  spaceDown: boolean
  pointerInside: boolean
  miniOn: boolean
  miniMap: { b: Rect; k: number; ox: number; oy: number } | null
  miniDrag: { b: Rect | null; sx: number; sy: number; moved: boolean } | null
  menuEl: HTMLDivElement | null
  cmp: CompareState | null
  renaming: { g: GroupRec; nm: HTMLElement; old: string } | null
  /** Selection the toolbar was built for. */
  tbKey: string
  tbW: number
  tbH: number
  zoomTxt: string
  theme: CanvasTheme
  themeExplicit: boolean
  touches: Map<number, Point>
  /** Safari trackpad pinch. */
  gesture: { s: number; p: Point | null }
  /** Minimap colours, read from the tokens. */
  colors: { ink: string; accent: string }
  fx: Fx
}
