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

import { downloadImage } from '@/features/draw/lib/images'

import type { ActionPayload, CanvasApi, MarkInfo } from '../../lib/canvas/types'
import { deletePicture, retryPicture } from '../../lib/engine'
import { edit } from '../../lib/project-edit'
import type { Project } from '../../types'

/* What the canvas's actions do on the drawing page. */

export type CanvasCallbacks = {
  /** 接着改: the page puts "@label" into the composer. */
  onEdit: (nodeId: string) => void
  /**
   * 完成圈选: the picture with the marks drawn on (PNG data URL), and the
   * marks with their numbers and notes (for "① 换成红色").
   */
  onMarked: (nodeId: string, dataUrl: string, marks: MarkInfo[]) => void
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

function download(x: ActionContext, p: ActionPayload) {
  const nodes = new Map(x.project.nodes.map((n) => [n.id, n]))
  for (const pn of p.nodes) {
    const img = pn.status === 'ready' ? nodes.get(pn.id)?.img : undefined
    if (!img) continue
    downloadImage(img.id).catch(() => x.cv.toast(x.t('Download failed')))
  }
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
      if (p.node) x.cb.onEdit(p.node.id)
      return false
    case 'mark-done':
      if (p.node && p.dataUrl) {
        x.cb.onMarked(p.node.id, p.dataUrl, p.marks ?? [])
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
      remove(pid, p)
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
