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
import {
  baseItem,
  currentRoom,
  findItem,
  heldCostOf,
  newId,
  pendingItems,
  useDrawStore,
} from '@/stores/draw-store'

import { MAX_IMAGES, MAX_PENDING } from '../constants'
import type {
  DrawAttachment,
  DrawItem,
  DrawPlanPart,
  DrawRequest,
  DrawResultMessage,
  DrawRoom,
  MarkStroke,
} from '../types'
import { drawAsOne, drawParts, planAndDraw, startDrawing } from './generate'
import {
  canvasBlob,
  copyBlob,
  drawToCanvas,
  prepareImage,
  primeImageUrls,
  revokeImageUrls,
} from './images'
import { drawStrokes } from './marks'
import { suggestionOptions, titleFrom } from './prompt'
import {
  deleteRoom as deleteStoredRoom,
  getImageBlob,
  imagesOf,
  putImage,
} from './storage'

/* User actions on conversations; React components call these. */

/** Pictures that go with the next request: the edited one, its marks, references. */
export function attachments(
  room: DrawRoom,
  refs: DrawAttachment[]
): DrawAttachment[] {
  const out: DrawAttachment[] = []
  const base = baseItem(room)
  if (base?.img) {
    out.push({ ...base.img, kind: 'base' })
    if (room.mark?.item === base.id) {
      out.push({ ...room.mark.img, kind: 'mark' })
    }
  }
  return [...out, ...refs]
}

export function isFull(): boolean {
  return pendingItems(useDrawStore.getState().rooms).length >= MAX_PENDING
}

export function heldCost(): number {
  return heldCostOf(useDrawStore.getState().rooms)
}

export type SendResult = 'sent' | 'empty' | 'full' | 'balance'

/** Sends the composer's text; `est` is the estimate shown next to the send button. */
export function sendDraft(est: number, balanceUsd: number | null): SendResult {
  const s = useDrawStore.getState()
  const text = s.draft.text.trim()
  if (!text) return 'empty'
  if (isFull()) return 'full'
  if (balanceUsd != null && balanceUsd - heldCost() < est) return 'balance'

  const room = currentRoom(s)
  const base = baseItem(room)
  const imgs = attachments(room, s.draft.refs)
  const req: DrawRequest = {
    text,
    imgs,
    ratio: s.draft.ratio,
    clear: s.draft.clear,
    model: room.model,
    marks: base && room.mark?.item === base.id ? room.mark.strokes : null,
  }
  const userMsg = {
    id: newId('m'),
    role: 'user' as const,
    text,
    imgs,
    ratio: req.ratio,
    clear: req.clear,
  }
  // The planner first decides whether this is one picture or several.
  const aiMsg: DrawResultMessage = {
    id: newId('m'),
    role: 'ai',
    items: [],
    plan: { status: 'planning', parts: [] },
    req,
    est,
    parent: base?.id ?? null,
  }
  const next: DrawRoom = {
    ...room,
    title: room.fresh ? titleFrom(text) : room.title,
    t: Date.now(),
    mark: null,
    msgs: [...room.msgs, userMsg, aiMsg],
  }
  s.putRoom(next)
  s.setDraft({ text: '', refs: [] })
  s.setIdea(null)
  s.setMode(null)
  void planAndDraw(room.id, aiMsg.id, balanceUsd)
  return 'sent'
}

/** 开始画: draws the parts of a plan that waited, as the user left them. */
export function confirmPlan(
  room: DrawRoom,
  msg: DrawResultMessage,
  parts: DrawPlanPart[],
  balanceUsd: number | null
): SendResult {
  const kept = parts
    .map((p) => ({ ...p, text: p.text.trim() }))
    .filter((p) => p.text)
  if (!kept.length) return 'empty'
  if (isFull()) return 'full'
  const total = (msg.est ?? 0) * kept.length
  if (balanceUsd != null && balanceUsd - heldCost() < total) return 'balance'
  drawParts(room.id, msg.id, kept)
  return 'sent'
}

/** 按原话画一张: ignores the plan and draws what the user wrote. */
export function drawPlanAsOne(
  room: DrawRoom,
  msg: DrawResultMessage,
  balanceUsd: number | null
): SendResult {
  if (isFull()) return 'full'
  if (balanceUsd != null && balanceUsd - heldCost() < (msg.est ?? 0)) {
    return 'balance'
  }
  drawAsOne(room.id, msg.id)
  return 'sent'
}

/** The page closed while planning: plan the same message again. */
export function replan(
  room: DrawRoom,
  msg: DrawResultMessage,
  balanceUsd: number | null
) {
  useDrawStore.getState().updateRoom(room.id, (r) => ({
    ...r,
    msgs: r.msgs.map((m) =>
      m.id === msg.id && m.role === 'ai'
        ? { ...m, plan: { status: 'planning' as const, parts: [] } }
        : m
    ),
  }))
  void planAndDraw(room.id, msg.id, balanceUsd)
}

function resultMessageOf(room: DrawRoom, itemId: string) {
  return room.msgs.find(
    (m) => m.role === 'ai' && m.items.some((it) => it.id === itemId)
  )
}

/** 再画一张: another picture from the same request, next to this one. */
export function drawAgain(room: DrawRoom, item: DrawItem): boolean {
  if (isFull()) return false
  const msg = resultMessageOf(room, item.id)
  if (!msg) return false
  startDrawing({
    roomId: room.id,
    msgId: msg.id,
    req: item.req,
    parent: item.parent,
    est: item.est,
    part: item.part,
  })
  return true
}

export function retryItem(room: DrawRoom, item: DrawItem): boolean {
  if (isFull()) return false
  const msg = resultMessageOf(room, item.id)
  if (!msg) return false
  startDrawing({
    roomId: room.id,
    msgId: msg.id,
    req: item.req,
    parent: item.parent,
    est: item.est,
    replace: item.id,
    part: item.part,
  })
  return true
}

/** 修改描述: drops the failed picture and puts its words back in the composer. */
export function fixItem(room: DrawRoom, item: DrawItem) {
  const s = useDrawStore.getState()
  s.updateRoom(room.id, (r) => {
    const msgs = [...r.msgs]
    const i = msgs.findIndex(
      (m) => m.role === 'ai' && m.items.some((it) => it.id === item.id)
    )
    if (i < 0) return r
    const msg = msgs[i]
    if (msg.role !== 'ai') return r
    const items = msg.items.filter((it) => it.id !== item.id)
    if (items.length) msgs[i] = { ...msg, items }
    else msgs.splice(i - 1, 2)
    return { ...r, msgs, sel: null }
  })
  s.setDraft({
    text: item.req.text,
    ratio: item.req.ratio,
    clear: item.req.clear,
  })
}

export function selectItem(id: string) {
  const s = useDrawStore.getState()
  const room = currentRoom(s)
  const it = findItem(room, id)
  if (!it) return
  if (s.mode === 'compare' && it.img && it.id !== room.sel) {
    s.setCmp(id)
    return
  }
  s.updateRoom(room.id, (r) => ({
    ...r,
    sel: id,
    detached: false,
    mark: r.mark?.item === id ? r.mark : null,
  }))
  if (s.mode === 'mark') s.setMode(null)
  if (s.mode === 'compare') {
    const parent = findItem(room, it.parent)
    s.setMode('compare', parent?.img ? parent.id : null)
  }
}

/** "↳" suggestion: fills the composer, never sends. */
export function applySuggestion(room: DrawRoom, item: DrawItem, text: string) {
  const s = useDrawStore.getState()
  s.updateRoom(room.id, (r) => ({
    ...r,
    sel: item.id,
    detached: false,
    mark: r.mark?.item === item.id ? r.mark : null,
  }))
  const opts = suggestionOptions(text)
  s.setDraft({
    text,
    ...(opts.ratio ? { ratio: opts.ratio } : {}),
    ...(opts.clear ? { clear: true } : {}),
  })
}

/** Turns the circles drawn on the canvas into the annotated copy we send. */
export async function finishMarking(
  room: DrawRoom,
  item: DrawItem,
  strokes: MarkStroke[]
) {
  const s = useDrawStore.getState()
  if (!item.img || !s.uid) return
  const blob = await getImageBlob(item.img.id, 'full')
  if (!blob) throw new Error('Picture not found')
  const canvas = await drawToCanvas(blob, Math.min(1024, item.img.w))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2D canvas')
  drawStrokes(ctx, canvas.width, canvas.height, strokes)
  const marked = await canvasBlob(canvas, 'image/jpeg', 0.86)
  const id = newId('k')
  const prepared = await prepareImage(marked, false)
  primeImageUrls(id, marked, prepared.thumb)
  await putImage(s.uid, id, marked, prepared.thumb)
  s.updateRoom(room.id, (r) => ({
    ...r,
    sel: item.id,
    detached: false,
    mark: { item: item.id, img: { id, w: prepared.w, h: prepared.h }, strokes },
  }))
  s.setMode(null)
}

/**
 * Stores pasted, dropped or picked files as references. Returns how many fit,
 * and how many could not be read.
 */
export async function addFiles(
  files: Iterable<File>
): Promise<{ added: number; skipped: number; failed: number }> {
  const s = useDrawStore.getState()
  if (!s.uid) return { added: 0, skipped: 0, failed: 0 }
  let added = 0
  let skipped = 0
  let failed = 0
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    const st = useDrawStore.getState()
    if (attachments(currentRoom(st), st.draft.refs).length >= MAX_IMAGES) {
      skipped++
      continue
    }
    const id = newId('u')
    // Store the picture's own bytes, not the File: a pasted or dropped file
    // can point at data the browser later cannot read or upload.
    let data: Blob
    let prepared: Awaited<ReturnType<typeof prepareImage>>
    try {
      data = await copyBlob(file)
      prepared = await prepareImage(
        data,
        file.type === 'image/png' || file.type === 'image/webp'
      )
    } catch {
      failed++
      continue
    }
    primeImageUrls(id, data, prepared.thumb)
    await putImage(s.uid, id, data, prepared.thumb)
    const ref: DrawAttachment = {
      id,
      w: prepared.w,
      h: prepared.h,
      kind: 'ref',
      name: file.name,
    }
    useDrawStore
      .getState()
      .setDraft({ refs: [...useDrawStore.getState().draft.refs, ref] })
    added++
  }
  return { added, skipped, failed }
}

/** A picture from this conversation as a reference; false when 4 are attached. */
export function addReference(room: DrawRoom, item: DrawItem): boolean {
  const s = useDrawStore.getState()
  if (!item.img) return false
  if (attachments(room, s.draft.refs).length >= MAX_IMAGES) return false
  s.setDraft({ refs: [...s.draft.refs, { ...item.img, kind: 'ref' }] })
  return true
}

/** Edit this picture next (right-click → 接着改这张). */
export function editItem(room: DrawRoom, item: DrawItem) {
  const s = useDrawStore.getState()
  s.updateRoom(room.id, (r) => ({
    ...r,
    sel: item.id,
    detached: false,
    mark: r.mark?.item === item.id ? r.mark : null,
  }))
  s.setMode(null)
}

export function detachBase(room: DrawRoom) {
  useDrawStore
    .getState()
    .updateRoom(room.id, (r) => ({ ...r, detached: true, mark: null }))
}

export function dropMark(room: DrawRoom) {
  useDrawStore.getState().updateRoom(room.id, (r) => ({ ...r, mark: null }))
}

export function renameRoom(room: DrawRoom, title: string) {
  const name = title.trim().slice(0, 40)
  if (!name) return
  useDrawStore.getState().updateRoom(room.id, (r) => ({ ...r, title: name }))
}

const pendingDeletes = new Map<string, ReturnType<typeof setTimeout>>()

/** Removes a conversation now and from storage a little later; returns undo. */
export function deleteRoomWithUndo(room: DrawRoom): () => void {
  const s = useDrawStore.getState()
  s.removeRoom(room.id)
  const timer = setTimeout(() => {
    pendingDeletes.delete(room.id)
    const others = new Set(
      useDrawStore
        .getState()
        .rooms.flatMap((r) => imagesOf(r).map((img) => img.id))
    )
    void deleteStoredRoom(room, others).then(() =>
      revokeImageUrls(
        imagesOf(room)
          .map((img) => img.id)
          .filter((id) => !others.has(id))
      )
    )
  }, 6000)
  pendingDeletes.set(room.id, timer)
  return () => {
    const pending = pendingDeletes.get(room.id)
    if (pending) clearTimeout(pending)
    pendingDeletes.delete(room.id)
    const st = useDrawStore.getState()
    st.putRoom(room)
    st.setCur(room.id)
  }
}
