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

/**
 * Every piece of UI text the canvas shows. The page passes translated
 * strings (t(...)); the defaults are the English i18n keys.
 */
export type CanvasLabels = {
  canvas: string
  canvasTools: string
  pictureActions: string
  select: string
  selectTip: string
  hand: string
  handTip: string
  mark: string
  markTip: string
  upload: string
  uploadTip: string
  minimap: string
  zoom: string
  dropHint: string
  edit: string
  compare: string
  download: string
  copyPrompt: string
  more: string
  retry: string
  delete: string
  exportSet: string
  viewSet: string
  rename: string
  untitled: string
  drawing: string
  failedNote: string
  /** Under a waiting picture: "Drawing · 1024 × 1024". */
  drawingSize: (size: string) => string
  failedSize: (size: string) => string
  /** Under a selected frame. */
  setCount: (count: number) => string
  selectedCount: (count: number) => string
  markFirst: string
  thisPicture: string
  exitMark: string
  exitMarkTip: string
  markPickFirst: string
  markEmpty: string
  markNote: string
  markNoteLabel: (n: number) => string
  markRemove: string
  markRemoveLabel: (n: number) => string
  clear: string
  markDone: string
  noPrompt: string
  promptCopied: string
  copyFailed: string
  pickToCompare: string
  deleteSet: string
  downloadCount: (count: number) => string
  viewThese: string
  viewLarger: string
  markWhat: string
  compareWith: string
  seconds: (count: number) => string
  fitAll: string
  zoom100: string
  zoomIn: string
  zoomOut: string
  fitSelection: string
  bothReady: string
  compareTitle: string
  slide: string
  sideBySide: string
  closeTip: string
  closeCompare: string
  slideHint: string
  escClose: string
  divider: string
}

export const DEFAULT_LABELS: CanvasLabels = {
  canvas: 'Canvas',
  canvasTools: 'Canvas tools',
  pictureActions: 'Picture actions',
  select: 'Select',
  selectTip: 'Select (V)',
  hand: 'Hand',
  handTip: 'Hand (H) · or hold Space and drag',
  mark: 'Circle',
  markTip: 'Circle (M) · circle what to change on the picture',
  upload: 'Upload pictures',
  uploadTip: 'Upload pictures · or drop them on the canvas',
  minimap: 'Minimap',
  zoom: 'Zoom',
  dropHint: 'Let go to put the pictures on the canvas',
  edit: 'Keep editing',
  compare: 'Compare',
  download: 'Download',
  copyPrompt: 'Copy description',
  more: 'More',
  retry: 'Retry',
  delete: 'Delete',
  exportSet: 'Export this set',
  viewSet: 'View this set',
  rename: 'Rename',
  untitled: 'Untitled',
  drawing: 'Drawing now',
  failedNote: 'Not drawn · not charged',
  drawingSize: (size) => `Drawing · ${size}`,
  failedSize: (size) => `Not drawn · ${size}`,
  setCount: (count) => `${count} pictures in this set`,
  selectedCount: (count) => `${count} pictures selected`,
  markFirst: 'Click a finished picture, then circle what to change on it',
  thisPicture: 'This picture',
  exitMark: 'Exit circling',
  exitMarkTip: 'Exit circling (Esc)',
  markPickFirst:
    'Click a finished picture first, then circle what to change with the red pen.',
  markEmpty:
    'Draw a circle on the picture to mark what to change. You can circle several places.',
  markNote: 'How to change this? (optional)',
  markNoteLabel: (n) => `How to change area ${n}`,
  markRemove: 'Remove this one',
  markRemoveLabel: (n) => `Remove area ${n}`,
  clear: 'Clear',
  markDone: 'Done circling',
  noPrompt: 'This picture has no description',
  promptCopied: 'Description copied',
  copyFailed: 'Copy failed; please copy it by hand',
  pickToCompare: 'Click another picture to compare · Esc to cancel',
  deleteSet: 'Delete this set',
  downloadCount: (count) => `Download ${count}`,
  viewThese: 'View these',
  viewLarger: 'View larger',
  markWhat: 'Circle what to change',
  compareWith: 'Compare…',
  seconds: (count) => `${count} s`,
  fitAll: 'Fit all',
  zoom100: 'Zoom to 100%',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fitSelection: 'Fit selection',
  bothReady: 'Both pictures must be finished to compare',
  compareTitle: 'Compare two pictures',
  slide: 'Slide',
  sideBySide: 'Side by side',
  closeTip: 'Close (Esc)',
  closeCompare: 'Close compare',
  slideHint: 'Drag the line in the middle · ← → to nudge · Esc to close',
  escClose: 'Esc to close',
  divider: 'Compare divider',
}

/** Labels with the given ones on top; undefined entries keep the old text. */
export function mergeLabels(
  base: CanvasLabels,
  patch?: Partial<CanvasLabels>
): CanvasLabels {
  const out = { ...base }
  if (!patch) return out
  for (const key of Object.keys(patch) as Array<keyof CanvasLabels>) {
    const value = patch[key]
    if (value !== undefined) Object.assign(out, { [key]: value })
  }
  return out
}
