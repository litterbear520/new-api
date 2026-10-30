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
import type { CanvasLabels } from './labels'

/*
 * Public types of the infinite canvas (lib/canvas/canvas.ts). World units
 * are picture pixels at 100%; screen points are px inside the canvas.
 */

/** What a picture on the canvas shows; the page maps 'stopped' to 'failed'. */
export type NodeStatus = 'pending' | 'ready' | 'failed'
export type Tool = 'select' | 'hand' | 'mark'
export type CanvasTheme = 'light' | 'dark'
export type Camera = { x: number; y: number; s: number }
export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; w: number; h: number }
/** A point on a picture, both coordinates 0–1. */
export type UV = [number, number]

/** Free-form facts about a picture; the canvas reads these four. */
export type CanvasMeta = {
  model?: string
  /** USD */
  cost?: number
  secs?: number
  prompt?: string
  [key: string]: unknown
}

/** A 圈选 mark as kept in the state (points 0–1). */
export type MarkState = { pts: UV[]; closed: boolean; note: string }

/** A 圈选 mark handed to the page (points in picture pixels). */
export type MarkInfo = {
  n: number
  note: string
  closed: boolean
  points: Array<[number, number]>
}

export type PublicNode = {
  type: 'image'
  id: string
  groupId: string | null
  src: string | null
  /** A small copy, shown while the picture is small on screen. */
  thumb: string | null
  /** Picture size. */
  w: number
  h: number
  /** Size shown on the canvas (world units). */
  dw: number
  dh: number
  label: string
  status: NodeStatus
  meta: CanvasMeta
  x: number
  y: number
  marks: MarkInfo[]
}

export type PublicGroup = {
  type: 'group'
  id: string
  title: string
  subtitle: string
  x: number
  y: number
  w: number
  h: number
  children: string[]
}

export type GroupSpec = {
  id?: string
  title?: string
  subtitle?: string
  /** Without x and y the frame goes below everything else. */
  x?: number
  y?: number
}
export type GroupPatch = Omit<GroupSpec, 'id'>

export type ImageSpec = {
  id?: string
  groupId?: string | null
  /** Place among the frame's pictures (default: last). */
  index?: number
  src?: string | null
  /**
   * A small copy of src (the 640 px thumbnail): shown while the picture
   * covers fewer screen pixels than it has, so opening a canvas full of
   * big pictures decodes small ones; src replaces it on zooming in.
   */
  thumb?: string | null
  w?: number
  h?: number
  /** Width the user gave it on the canvas. */
  dw?: number
  label?: string
  status?: NodeStatus
  meta?: CanvasMeta
  /** For pictures outside a frame; without them it goes below everything. */
  x?: number
  y?: number
  marks?: MarkState[]
}
export type ImagePatch = Omit<ImageSpec, 'id' | 'index' | 'marks'>

export type GroupState = {
  id: string
  title: string
  subtitle: string
  x: number
  y: number
  children: string[]
}

export type ImageState = {
  id: string
  groupId: string | null
  src: string | null
  w: number
  h: number
  /** Only when the user resized it. */
  dw?: number
  label: string
  status: NodeStatus
  meta: CanvasMeta
  /** Only outside a frame. */
  x?: number
  y?: number
  marks: MarkState[]
}

export type CanvasState = {
  v: 1
  camera: Camera
  /** The camera only follows fits so far (the user never moved it). */
  fitted: boolean
  groups: GroupState[]
  images: ImageState[]
}

/** What setState takes: missing positions are placed like new frames. */
export type CanvasStateInput = {
  camera?: Camera | null
  groups?: Array<Partial<GroupState> & { id: string }>
  images?: Array<ImageSpec & { id: string }>
}

export type SelectionKind = 'group' | 'image' | 'multi'

/**
 * Built-in action ids: edit, mark, compare, download, copy-prompt, more,
 * retry, delete, export, fit, rename, fit-all, zoom-100, upload, drop-files
 * (also pasted files) and mark-done. Pages may add their own.
 */
export type ActionId = string

export type ActionPayload = {
  ids: string[]
  kind: SelectionKind | null
  nodes: PublicNode[]
  /** Set when exactly one picture is meant. */
  node?: PublicNode
  group?: PublicGroup
  /** Under the toolbar button that was pressed (screen px). */
  anchor?: Point
  /** Where files were dropped or the menu was opened (world units). */
  worldPoint?: Point
  files?: File[]
  /** mark-done: the marks and the picture with them drawn on (PNG). */
  marks?: MarkInfo[]
  dataUrl?: string | null
  /** The picture could not be read; dataUrl holds only the marks. */
  marksOnly?: boolean
  /** rename: the new frame title. */
  title?: string
}

/** A button of the floating toolbar. */
export type ActionSpec = {
  id: ActionId
  label: string
  /** SVG markup. */
  icon?: string
  title?: string
  primary?: boolean
  iconOnly?: boolean
  /** Picture states it shows for (default: ready only). */
  statuses?: NodeStatus[]
  /** Several pictures: only for exactly this many. */
  exactly?: number
}

export type MenuItem =
  | { sep: true }
  | {
      sep?: false
      id?: ActionId
      label: string
      /** SVG markup. */
      icon?: string
      kbd?: string
      danger?: boolean
      disabled?: boolean
      payload?: Partial<ActionPayload>
      /** Runs instead of the action. */
      run?: () => void
    }

export type MenuTarget = PublicNode | PublicGroup | PublicNode[] | null

export type FocusOptions = {
  animate?: boolean
  /** Do not zoom in further than this (default 1 = 100%). */
  maxScale?: number
  duration?: number
}

export type CanvasOptions = {
  /** UI text; English by default. */
  labels?: Partial<CanvasLabels>
  minimap?: boolean
  /** Move the camera to new frames and pictures (default true). */
  autoFocus?: boolean
  imageActions?: ActionSpec[]
  groupActions?: ActionSpec[]
  multiActions?: ActionSpec[]
  /** Money in the picture menu (default "$0.034"). */
  formatCost?: (usd: number) => string
  /** Runs before the built-in behaviour; returning false skips it. */
  onAction?: (id: ActionId, payload: ActionPayload) => boolean | void
  /** Positions, sizes, marks or the camera changed (debounced). */
  onChange?: (state: CanvasState) => void
  /** The user changed the selection. */
  onSelect?: (ids: string[]) => void
  /** A picture's content was (re)drawn. */
  onRendered?: (el: HTMLElement, node: PublicNode) => void
  /** Fills a waiting picture's slot (default: dots and "Drawing now"). */
  renderPending?: (slot: HTMLElement, node: PublicNode) => void
  /**
   * Shows a finished picture over its waiting slot. `img` is already in
   * `media`; `old` goes away once the returned promise settles.
   */
  revealer?: (
    media: HTMLElement,
    img: HTMLImageElement,
    old: Element[],
    node: PublicNode
  ) => Promise<void> | null | undefined
  /** Replaces the right-click menu; an array (even empty) wins. */
  contextMenu?: (target: MenuTarget) => MenuItem[] | null | undefined
}

export type CanvasApi = {
  el: HTMLDivElement
  addGroup: (spec?: GroupSpec) => PublicGroup
  updateGroup: (id: string, patch: GroupPatch) => void
  addImage: (spec?: ImageSpec) => PublicNode
  updateImage: (id: string, patch: ImagePatch) => PublicNode | null
  remove: (id: string) => void
  select: (ids: string[] | string | null) => void
  getSelection: () => string[]
  getNode: (id: string) => PublicNode | PublicGroup | null
  /** Frames the given ids, or everything for 'all' / null. */
  focus: (ids: string[] | string | null, opt?: FocusOptions) => void
  setTool: (tool: Tool) => void
  getTool: () => Tool
  zoomTo: (scale: number, opt?: { animate?: boolean }) => void
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
  getCamera: () => Camera
  setCamera: (camera: Camera, opt?: { animate?: boolean }) => void
  compare: (a: string, b: string) => void
  closeCompare: () => void
  clearMarks: (id?: string) => void
  setMinimap: (on: boolean) => void
  /** ms = 0 keeps it until the next toast. */
  toast: (message: string, ms?: number) => void
  getState: () => CanvasState
  setState: (state: CanvasStateInput | string) => void
  setTheme: (theme: CanvasTheme) => void
  getTheme: () => CanvasTheme
  /** New UI text, e.g. after the language changed. */
  setLabels: (labels: Partial<CanvasLabels>) => void
  destroy: () => void
}
