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
import { t } from 'i18next'

import { findProject, newId } from '@/stores/bear-draw-store'

import { IMAGE_MODEL_META, ratioSize } from '../constants'
import type {
  AgentMessage,
  Attachment,
  CanvasNode,
  Part,
  PictureJob,
  ProgressItem,
  Project,
  UserMessage,
} from '../types'
import { finishTurn } from './agent/finish'
import { composePrompt } from './agent/plan'
import { drawPicture } from './pictures'
import { addGroup, addMessage, addPart, edit } from './project-edit'

/*
 * Image mode: no planner. The words go to the image model as typed, with
 * the attached pictures, `count` times at once (each its own request).
 */

/** Inputs for an image-mode message: the marked picture's original first, then the rest. */
export function imageInputs(p: Project | null, refs: Attachment[]) {
  const ids: string[] = []
  const roles: string[] = []
  const marked = refs.find((r) => r.marked)
  if (marked) {
    const node = p?.nodes.find((n) => n.id === marked.nodeId && n.img)
    const base =
      refs.find((r) => !r.marked && r.nodeId === marked.nodeId)?.id ??
      node?.img?.id
    if (base) {
      ids.push(base)
      roles.push('the picture to edit')
    }
    ids.push(marked.id)
    roles.push(
      'the same picture with red numbered circles marking where to change (a guide only; change only inside the circles and never draw them)'
    )
  }
  for (const r of refs) {
    if (ids.includes(r.id) || r.marked) continue
    ids.push(r.id)
    roles.push(r.nodeId && !marked ? 'the picture to edit' : 'a reference')
  }
  return { ids, roles }
}

export function titleFrom(text: string): string {
  const flat = text.replaceAll(/\s+/g, ' ').trim()
  return flat.length > 16 ? `${flat.slice(0, 16)}…` : flat
}

const turns = new Map<string, number>()

/** Image-mode turns running in a project. */
export function imageTurns(projectId: string): number {
  return turns.get(projectId) ?? 0
}

export async function runImageTurn(
  projectId: string,
  user: UserMessage,
  onEnd: () => void
): Promise<void> {
  const settings = user.image
  if (!settings) return
  const message: AgentMessage = {
    id: newId('m'),
    role: 'agent',
    mode: 'image',
    parts: [],
    status: 'running',
    startedAt: Date.now(),
    cost: 0,
  }
  addMessage(projectId, message)
  const title = titleFrom(user.text) || t('Untitled')
  edit(projectId, (x) => (x.title ? x : { ...x, title }))

  const p = findProject(projectId)
  const inputs = imageInputs(p, user.refs)
  const prompt = composePrompt(
    user.text,
    settings.ratio,
    settings.transparent,
    inputs.roles
  )
  const job: PictureJob = {
    model: settings.model,
    prompt,
    transparent: settings.transparent,
    inputs: inputs.ids,
    ratio: settings.ratio,
  }
  const groupId = newId('g')
  const [w, h] = ratioSize(settings.ratio)
  const nodes: CanvasNode[] = []
  const items: ProgressItem[] = []
  for (let i = 0; i < settings.count; i++) {
    const nodeId = newId('n')
    const label =
      settings.count > 1 ? t('No. {{n}}', { n: i + 1 }) : t('Picture')
    nodes.push({
      id: nodeId,
      groupId,
      status: 'pending',
      w,
      h,
      label,
      meta: { model: settings.model, prompt: user.text },
    })
    items.push({
      id: newId('it'),
      nodeId,
      label,
      model: settings.model,
      prompt: user.text,
      status: 'queued',
      edit: inputs.ids.length > 0,
      job,
    })
  }
  const short = IMAGE_MODEL_META[settings.model]?.short ?? settings.model
  addGroup(
    projectId,
    {
      id: groupId,
      title,
      subtitle: `${t('{{count}} pictures', { count: settings.count })} · ${short}`,
      children: nodes.map((n) => n.id),
    },
    nodes
  )
  const progress = addPart<Extract<Part, { type: 'progress' }>>(
    projectId,
    message.id,
    { type: 'progress', groupId, items, compact: true }
  )
  turns.set(projectId, imageTurns(projectId) + 1)
  try {
    await Promise.all(
      items.map((it) =>
        drawPicture(
          {
            projectId,
            messageId: message.id,
            partId: progress.id,
            itemId: it.id,
            nodeId: it.nodeId,
          },
          job
        )
      )
    )
  } finally {
    turns.set(projectId, Math.max(0, imageTurns(projectId) - 1))
    finishTurn(projectId, message.id, 'done')
    onEnd()
  }
}
