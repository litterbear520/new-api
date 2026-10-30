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
import { loadRooms } from '@/features/draw/lib/storage'
import type { DrawItem, DrawRatio, DrawRoom } from '@/features/draw/types'

import { STORAGE_KEYS } from '../constants'
import type {
  AgentMessage,
  CanvasGroup,
  CanvasNode,
  Message,
  ProgressItem,
  ProgressStatus,
  Project,
  Ratio,
} from '../types'

/*
 * Conversations of the classic drawing page are copied into projects once
 * per account and browser, so nothing seems lost when /draw changes. The
 * pictures are not copied: projects point at the same stored blobs, and
 * deleting a copied project leaves them alone.
 */

const RATIO: Record<DrawRatio, Ratio> = {
  auto: 'auto',
  square: '1:1',
  land: '16:9',
  port: '9:16',
}

function itemStatus(it: DrawItem): ProgressStatus {
  if (it.status === 'done') return 'done'
  if (it.error?.kind === 'lost' || it.status === 'pending') return 'lost'
  return 'failed'
}

function shortTitle(text: string): string {
  const flat = text.replaceAll(/\s+/g, ' ').trim()
  return flat.length > 16 ? `${flat.slice(0, 16)}…` : flat
}

/** One classic conversation as a project (pure; exported for tests). */
export function roomToProject(room: DrawRoom): Project {
  const messages: Message[] = []
  const groups: CanvasGroup[] = []
  const nodes: CanvasNode[] = []
  let cost = 0
  let lastText = room.title
  for (const msg of room.msgs) {
    if (msg.role === 'user') {
      lastText = msg.text || lastText
      messages.push({
        id: `mig-${msg.id}`,
        role: 'user',
        at: room.t,
        mode: 'image',
        text: msg.text,
        refs: msg.imgs.map((img) => ({
          id: img.id,
          w: img.w,
          h: img.h,
          clear: img.clear,
          name: img.name,
          marked: img.kind === 'mark' || undefined,
        })),
        image: {
          model: room.model,
          ratio: RATIO[msg.ratio] ?? 'auto',
          count: 1,
          transparent: msg.clear,
        },
      })
      continue
    }
    if (!msg.items.length) continue
    const groupId = `mig-g-${msg.id}`
    const items: ProgressItem[] = msg.items.map((it) => {
      const nodeId = `mig-n-${it.id}`
      const status = itemStatus(it)
      const label = it.part?.title || shortTitle(it.req.text) || room.title
      nodes.push({
        id: nodeId,
        groupId,
        status: status === 'done' ? 'ready' : 'failed',
        img: it.img,
        w: it.img?.w ?? 1024,
        h: it.img?.h ?? 1024,
        label,
        meta: {
          model: it.req.model,
          prompt: it.req.text,
          cost: it.cost,
          secs: it.secs,
        },
      })
      cost += it.cost ?? 0
      return {
        id: `mig-it-${it.id}`,
        nodeId,
        label,
        model: it.req.model,
        prompt: it.req.text,
        status,
        secs: it.secs,
        cost: it.cost,
        img: it.img,
        error: status === 'done' ? undefined : it.error,
      }
    })
    groups.push({
      id: groupId,
      title: shortTitle(msg.req?.text ?? lastText) || room.title,
      subtitle: String(items.length),
      children: items.map((it) => it.nodeId),
    })
    const done = items.filter((it) => it.status === 'done').length
    const message: AgentMessage = {
      id: `mig-${msg.id}`,
      role: 'agent',
      mode: 'image',
      status: 'done',
      startedAt: room.t,
      endedAt: room.t,
      cost: items.reduce((s, it) => s + (it.cost ?? 0), 0),
      parts: [
        {
          id: `mig-pg-${msg.id}`,
          type: 'progress',
          groupId,
          items,
          compact: true,
        },
        {
          id: `mig-rs-${msg.id}`,
          type: 'result',
          done,
          failed: items.length - done,
          stopped: 0,
          cost: items.reduce((s, it) => s + (it.cost ?? 0), 0),
          secs: Math.max(...items.map((it) => it.secs ?? 0), 0),
          groupId,
          suggestions: [],
          compact: true,
        },
      ],
    }
    messages.push(message)
  }
  return {
    id: `mig-${room.id}`,
    title: room.title,
    createdAt: room.t,
    updatedAt: room.t,
    cost,
    messages,
    transcript: [],
    groups,
    nodes,
    camera: null,
    migrated: true,
  }
}

function flagKey(uid: number) {
  return `${STORAGE_KEYS.migrated}.${uid}`
}

/** The classic conversations not copied yet, as projects. */
export async function classicRooms(uid: number): Promise<Project[]> {
  try {
    if (localStorage.getItem(flagKey(uid)) === '1') return []
  } catch {
    return []
  }
  try {
    const rooms = await loadRooms(uid)
    return rooms.filter((r) => r.msgs.length).map(roomToProject)
  } catch {
    return []
  }
}

/** Called once the copies are saved (copying again would reuse the same ids). */
export function markMigrated(uid: number) {
  try {
    localStorage.setItem(flagKey(uid), '1')
  } catch {
    // Private mode: copied again next time, without duplicates.
  }
}
