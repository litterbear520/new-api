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
import type { TFunction } from 'i18next'

import type { CanvasLabels } from '../../lib/canvas/labels'

/** The canvas's UI text in the current language. */
export function canvasLabels(t: TFunction): CanvasLabels {
  return {
    canvas: t('Canvas'),
    canvasTools: t('Canvas tools'),
    pictureActions: t('Picture actions'),
    select: t('Select'),
    selectTip: t('Select (V)'),
    hand: t('Hand'),
    handTip: t('Hand (H) · or hold Space and drag'),
    mark: t('Circle'),
    markTip: t('Circle (M) · circle what to change on the picture'),
    upload: t('Upload pictures'),
    uploadTip: t('Upload pictures · or drop them on the canvas'),
    minimap: t('Minimap'),
    zoom: t('Zoom'),
    dropHint: t('Let go to put the pictures on the canvas'),
    edit: t('Keep editing'),
    compare: t('Compare'),
    download: t('Download'),
    copyPrompt: t('Copy description'),
    more: t('More'),
    retry: t('Retry'),
    delete: t('Delete'),
    exportSet: t('Export this set'),
    viewSet: t('View this set'),
    rename: t('Rename'),
    untitled: t('Untitled'),
    drawing: t('Drawing now'),
    failedNote: t('Not drawn · not charged'),
    drawingSize: (size) => t('Drawing · {{size}}', { size }),
    failedSize: (size) => t('Not drawn · {{size}}', { size }),
    setCount: (count) => t('{{count}} pictures in this set', { count }),
    selectedCount: (count) => t('{{count}} pictures selected', { count }),
    markFirst: t('Click a finished picture, then circle what to change on it'),
    thisPicture: t('This picture'),
    exitMark: t('Exit circling'),
    exitMarkTip: t('Exit circling (Esc)'),
    markPickFirst: t(
      'Click a finished picture first, then circle what to change with the red pen.'
    ),
    markEmpty: t(
      'Draw a circle on the picture to mark what to change. You can circle several places.'
    ),
    markNote: t('How to change this? (optional)'),
    markNoteLabel: (n) => t('How to change area {{n}}', { n }),
    markRemove: t('Remove this one'),
    markRemoveLabel: (n) => t('Remove area {{n}}', { n }),
    clear: t('Clear'),
    markDone: t('Done circling'),
    noPrompt: t('This picture has no description'),
    promptCopied: t('Description copied'),
    copyFailed: t('Copy failed; please copy it by hand'),
    pickToCompare: t('Click another picture to compare · Esc to cancel'),
    deleteSet: t('Delete this set'),
    downloadCount: (count) => t('Download {{count}}', { count }),
    viewThese: t('View these'),
    viewLarger: t('View larger'),
    markWhat: t('Circle what to change'),
    compareWith: t('Compare…'),
    seconds: (count) => t('{{count}} s', { count }),
    fitAll: t('Fit all'),
    zoom100: t('Zoom to 100%'),
    zoomIn: t('Zoom in'),
    zoomOut: t('Zoom out'),
    fitSelection: t('Fit selection'),
    bothReady: t('Both pictures must be finished to compare'),
    compareTitle: t('Compare two pictures'),
    slide: t('Slide'),
    sideBySide: t('Side by side'),
    closeTip: t('Close (Esc)'),
    closeCompare: t('Close compare'),
    slideHint: t('Drag the line in the middle · ← → to nudge · Esc to close'),
    escClose: t('Esc to close'),
    divider: t('Compare divider'),
  }
}
