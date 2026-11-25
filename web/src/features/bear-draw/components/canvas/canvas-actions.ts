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
import { toast } from 'sonner'

import { findProject } from '@/stores/bear-draw-store'

import type { ActionPayload, CanvasApi, MarkInfo } from '../../lib/canvas/types'
import { deletePicture, retryPicture } from '../../lib/engine'
import {
  downloadPictures,
  pictureFiles,
  shareFiles,
  sharesToPhotos,
} from '../../lib/export'
import { edit } from '../../lib/project-edit'
import type { Project } from '../../types'
import { deletedFrom, restoreDeleted } from './delete-undo'
import { blocksDownloads, openSaveSheet } from './save-sheet-state'

/* What the canvas's actions do on the drawing page. */

export type CanvasCallbacks = {
  /** 接着改: the page puts "@label" into the composer. */
  onEdit: (nodeIds: string[]) => void
  /**
   * 完成圈选: the picture with the marks drawn on (PNG), and the
   * marks with their numbers and notes (for "① 换成红色").
   */
  onMarked: (nodeId: string, png: Blob, marks: MarkInfo[]) => void
  /** Dropped, pasted or picked pictures. */
  onUpload: (files: File[]) => void
  /** 导出这一组 */
  onExport: (groupId: string) => void
}

export type ActionContext = {
  project: Project
  cb: CanvasCallbacks
  cv: CanvasApi
  t: TFunction
  /** Opens the file picker (上传图片). */
  pickFiles: () => void
}

/** Removing a frame removes its pictures, then the empty frame. */
function remove(projectId: string, p: ActionPayload) {
  if (p.kind !== 'group' || !p.group) {
    for (const id of p.ids) deletePicture(projectId, id)
    return
  }
  for (const n of p.nodes) deletePicture(projectId, n.id)
  const gid = p.group.id
  edit(projectId, (proj) =>
    proj.nodes.some((n) => n.groupId === gid)
      ? proj
      : { ...proj, groups: proj.groups.filter((g) => g.id !== gid) }
  )
}

/** Deletes, then offers 撤销 for a few seconds (no confirmation first). */
function removeWithUndo(x: ActionContext, p: ActionPayload) {
  const pid = x.project.id
  const before = findProject(pid)
  const set = p.kind === 'group' && p.group ? p.group.id : null
  const ids = set ? p.nodes.map((n) => n.id) : p.ids
  remove(pid, p)
  if (!before) return
  const del = deletedFrom(before, ids, set)
  if (!del.nodes.length && !set) return
  let message = x.t('Picture deleted')
  if (set) message = x.t('Set deleted')
  else if (del.nodes.length > 1) message = x.t('Pictures deleted')
  let undone = false
  toast(message, {
    action: {
      label: x.t('Undo'),
      onClick: () => {
        if (undone) return
        undone = true
        edit(pid, (proj) => restoreDeleted(proj, del))
      },
    },
    duration: 5000,
  })
}

/**
 * Opens the share sheet with these pictures; its 存储 N 张图像 saves them to
 * Photos. Reading or packing them can take long enough that Safari no longer
 * counts the tap: then a toast button shares them on its own tap. Returns
 * false when they can't be shared at all, for the caller to download them.
 */
async function offerShare(
  t: TFunction,
  files: File[],
  fallBack: () => void
): Promise<boolean> {
  const result = await shareFiles(files)
  if (result === 'unsupported' || result === 'failed') return false
  if (result !== 'blocked') return true
  toast(t('The pictures are ready'), {
    action: {
      label: t('Save to Photos'),
      onClick: () => {
        void shareFiles(files).then((again) => {
          if (again === 'unsupported' || again === 'failed') fallBack()
        })
      },
    },
    duration: 15000,
  })
  return true
}

/** Several pictures on a phone or tablet: the share sheet, else the ZIP. */
async function shareToPhotos(x: ActionContext, ids: string[]) {
  const failed = () => x.cv.toast(x.t('Download failed'))
  const fallBack = () =>
    downloadPictures(ids)
      .then((n) => {
        if (n) failed()
      })
      .catch(failed)
  const files = await pictureFiles(ids).catch(() => [])
  if (!files.length) {
    failed()
    return
  }
  if (!(await offerShare(x.t, files, () => void fallBack()))) {
    await fallBack()
    return
  }
  if (files.length < ids.length) failed()
}

/**
 * One picture as itself, several as one ZIP (on a phone or tablet: the share
 * sheet, to save them to Photos); WeChat and QQ: long press.
 */
function download(x: ActionContext, p: ActionPayload) {
  const nodes = new Map(x.project.nodes.map((n) => [n.id, n]))
  const ready = p.nodes.flatMap((pn) => {
    const n = pn.status === 'ready' ? nodes.get(pn.id) : undefined
    return n?.img
      ? [{ id: n.img.id, label: n.label, w: n.img.w, h: n.img.h }]
      : []
  })
  if (!ready.length) return
  if (blocksDownloads(navigator.userAgent)) {
    openSaveSheet(ready)
    return
  }
  if (ready.length > 1 && sharesToPhotos()) {
    void shareToPhotos(
      x,
      ready.map((r) => r.id)
    )
    return
  }
  const failed = () => x.cv.toast(x.t('Download failed'))
  downloadPictures(ready.map((r) => r.id))
    .then((n) => {
      if (n) failed()
    })
    .catch(failed)
}

function rename(projectId: string, groupId: string, title: string) {
  edit(projectId, (proj) => ({
    ...proj,
    groups: proj.groups.map((g) => (g.id === groupId ? { ...g, title } : g)),
  }))
}

/** Returns false when the page handled it (the canvas then does nothing). */
export function runCanvasAction(
  x: ActionContext,
  id: string,
  p: ActionPayload
): boolean | void {
  const pid = x.project.id
  switch (id) {
    case 'edit':
      if (p.node) x.cb.onEdit([p.node.id])
      return false
    case 'cite':
      x.cb.onEdit(p.nodes.filter((n) => n.status === 'ready').map((n) => n.id))
      return false
    case 'mark-done':
      if (p.node && p.png) {
        x.cb.onMarked(p.node.id, p.png, p.marks ?? [])
      }
      return false
    case 'export': {
      const gid = p.group?.id ?? p.ids[0]
      if (gid) x.cb.onExport(gid)
      return false
    }
    case 'retry':
      for (const nid of p.ids) retryPicture(pid, nid)
      return false
    case 'delete':
      removeWithUndo(x, p)
      return false
    case 'download':
      download(x, p)
      return false
    case 'upload':
      x.pickFiles()
      return false
    case 'drop-files':
      if (p.files?.length) x.cb.onUpload(p.files)
      return false
    case 'rename':
      if (p.group && p.title) rename(pid, p.group.id, p.title)
      return
    default:
      return
  }
}
