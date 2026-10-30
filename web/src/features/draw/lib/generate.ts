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
import type { PricingData } from '@/features/pricing/types'
import { getSelf } from '@/lib/api'
import { type AuthUser, useAuthStore } from '@/stores/auth-store'
import { findItem, heldCostOf, newId, useDrawStore } from '@/stores/draw-store'

import {
  DrawApiError,
  planPictures,
  requestImage,
  suggestEdits,
  type DrawPlanResult,
} from '../api'
import { CONFIRM_FROM, MAX_PENDING, PLAN_TIMEOUT_MS } from '../constants'
import type {
  DrawErrorKind,
  DrawItem,
  DrawPlanPart,
  DrawRequest,
  DrawResultMessage,
} from '../types'
import { costFromUsage } from './cost'
import { DrawKeyError, getDrawKey } from './draw-key'
import {
  blobToDataUrl,
  copyBlob,
  prepareImage,
  primeImageUrls,
  smallJpeg,
} from './images'
import { buildPrompt } from './prompt'
import {
  getImageBlob,
  isQuotaError,
  putImage,
  requestPersistence,
} from './storage'

/*
 * Drawing runs outside React: it keeps going when the user switches
 * conversations or leaves the page, and writes its result into the store.
 */

export type DrawEnv = {
  uid: number
  imageModels: string[]
  pricing?: PricingData
  groupRatio: number
  suggestModel?: string
  /** Chat models that may plan a request, tried in order. */
  planModels: string[]
}

export type DrawFinished = {
  roomId: string
  item: DrawItem
  ok: boolean
  /** Storage was full; the picture lasts only for this visit. */
  notSaved?: boolean
}

let env: DrawEnv | null = null
const listeners = new Set<(e: DrawFinished) => void>()

export function setDrawEnv(next: DrawEnv) {
  env = next
}

export function onDrawFinished(fn: (e: DrawFinished) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function errorOf(error: unknown): { kind: DrawErrorKind; message?: string } {
  if (error instanceof DrawApiError) {
    return { kind: error.kind, message: error.message }
  }
  if (error instanceof DrawKeyError) {
    return { kind: 'auth', message: error.message }
  }
  if (error instanceof Error) return { kind: 'other', message: error.message }
  return { kind: 'other' }
}

/** Re-reads the user so the balance shows what drawing has spent. */
export async function refreshBalance() {
  try {
    const res = (await getSelf()) as { success?: boolean; data?: AuthUser }
    if (res?.success && res.data) useAuthStore.getState().auth.setUser(res.data)
  } catch {
    // The balance refreshes on the next page load.
  }
}

async function inputImages(req: DrawRequest) {
  const out: Array<{ blob: Blob; name: string }> = []
  for (const [i, img] of req.imgs.entries()) {
    const stored = await getImageBlob(img.id, 'full')
    let blob: Blob | null = null
    try {
      blob = stored && (await copyBlob(stored))
    } catch {
      blob = null
    }
    if (!blob) {
      throw new DrawApiError('unreadable', 'An attached picture cannot be read')
    }
    out.push({
      blob,
      name: `image-${i + 1}.${blob.type.includes('jpeg') ? 'jpg' : 'png'}`,
    })
  }
  return out
}

async function draw(roomId: string, item: DrawItem) {
  const store = useDrawStore.getState()
  const e = env
  if (!e) throw new Error('Drawing is not ready')
  const images = await inputImages(item.req)
  const call = (key: string) =>
    requestImage({
      key,
      model: item.req.model,
      prompt: buildPrompt(item.req),
      clear: item.req.clear,
      images,
    })
  let result
  try {
    result = await call(await getDrawKey(e.uid, e.imageModels))
  } catch (error) {
    // A deleted or changed token: fetch it again once.
    if (!(error instanceof DrawApiError) || error.kind !== 'auth') throw error
    result = await call(await getDrawKey(e.uid, e.imageModels, true))
  }

  let notSaved = false
  const saved = []
  for (const pic of result.images) {
    const imgId = newId('i')
    const prepared = await prepareImage(pic.blob, item.req.clear)
    primeImageUrls(imgId, pic.blob, prepared.thumb)
    try {
      await putImage(e.uid, imgId, pic.blob, prepared.thumb)
      requestPersistence()
    } catch (error) {
      notSaved = isQuotaError(error)
      if (!notSaved) throw error
    }
    saved.push({ id: imgId, prepared, revised: pic.revised })
  }

  const model = e.pricing?.data.find((m) => m.model_name === item.req.model)
  const cost = costFromUsage(model, result.usage, e.groupRatio) ?? item.est
  const now = Date.now()
  const done = saved.map((pic, i): DrawItem => ({
    ...item,
    // Extra pictures in one reply sit right after this one.
    id: i === 0 ? item.id : newId('p'),
    status: 'done',
    img: {
      id: pic.id,
      w: pic.prepared.w,
      h: pic.prepared.h,
      clear: item.req.clear,
    },
    secs: Math.max(1, Math.round((now - item.start) / 1000)),
    // The reply is billed once; split it over its pictures.
    cost: cost / saved.length,
    revised: pic.revised,
    rv: now,
    unseen: true,
    error: undefined,
  }))
  store.updateRoom(roomId, (room) => {
    const msgs = room.msgs.map((m) =>
      m.role !== 'ai' || !m.items.some((it) => it.id === item.id)
        ? m
        : {
            ...m,
            items: m.items.flatMap((it) => (it.id === item.id ? done : [it])),
          }
    )
    // A split request shows its first finished picture on the canvas.
    const sel = findItem(room, room.sel)
    const sameMsg = room.msgs.some(
      (m) =>
        m.role === 'ai' &&
        m.items.some((it) => it.id === item.id) &&
        m.items.some((it) => it.id === sel?.id)
    )
    const showThis =
      item.part && sel?.id !== item.id && sel?.status === 'pending' && sameMsg
    return { ...room, msgs, ...(showThis ? { sel: item.id } : {}) }
  })
  listeners.forEach((fn) => fn({ roomId, item: done[0], ok: true, notSaved }))
  void refreshBalance()

  if (e.suggestModel) {
    suggestEdits(e.suggestModel, item.req.text)
      .then((sugs) => {
        if (sugs.length) {
          useDrawStore.getState().updateItem(roomId, item.id, { sugs })
        }
      })
      .catch(() => {
        // Suggestions are optional.
      })
  }
}

/*
 * At most MAX_PENDING pictures draw at once; the rest wait here without
 * sending anything, so a waiting picture is never charged.
 */
let running = 0
const waiting: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (running < MAX_PENDING) {
    running++
    return Promise.resolve()
  }
  return new Promise((resolve) =>
    waiting.push(() => {
      running++
      resolve()
    })
  )
}

function releaseSlot() {
  running--
  waiting.shift()?.()
}

function itemExists(roomId: string, itemId: string) {
  const room = useDrawStore.getState().rooms.find((r) => r.id === roomId)
  return Boolean(room && findItem(room, itemId))
}

async function runItem(roomId: string, queued: DrawItem) {
  await acquireSlot()
  try {
    // Deleted while waiting: send nothing.
    if (!itemExists(roomId, queued.id)) return
    let item = queued
    if (queued.queued) {
      item = { ...queued, queued: undefined, start: Date.now() }
      useDrawStore
        .getState()
        .updateItem(roomId, item.id, { queued: undefined, start: item.start })
    }
    await draw(roomId, item)
  } finally {
    releaseSlot()
  }
}

/** Adds a drawing picture to a result message and starts drawing it. */
export function startDrawing(opts: {
  roomId: string
  msgId: string
  req: DrawRequest
  parent: string | null
  est: number
  /** Retry: the failed picture this one replaces. */
  replace?: string
  part?: DrawItem['part']
  /** Show it on the canvas right away (the first picture of a split does). */
  select?: boolean
}) {
  const item: DrawItem = {
    id: newId('p'),
    req: opts.req,
    parent: opts.parent,
    start: Date.now(),
    status: 'pending',
    est: opts.est,
    ...(opts.part ? { part: opts.part } : {}),
    ...(running + waiting.length >= MAX_PENDING ? { queued: true } : {}),
  }
  const select = opts.select ?? true
  useDrawStore.getState().updateRoom(opts.roomId, (room) => ({
    ...room,
    t: Date.now(),
    ...(select ? { sel: item.id, detached: false } : {}),
    msgs: room.msgs.map((m) => {
      if (m.id !== opts.msgId || m.role !== 'ai') return m
      if (!opts.replace) return { ...m, items: [...m.items, item] }
      return {
        ...m,
        items: m.items.map((it) => (it.id === opts.replace ? item : it)),
      }
    }),
  }))
  runItem(opts.roomId, item).catch((error: unknown) => {
    const patch: Partial<DrawItem> = { status: 'error', error: errorOf(error) }
    useDrawStore.getState().updateItem(opts.roomId, item.id, patch)
    listeners.forEach((fn) =>
      fn({ roomId: opts.roomId, item: { ...item, ...patch }, ok: false })
    )
  })
  return item
}

// ---------------------------------------------------------------------------
// Splitting one message into separate pictures
// ---------------------------------------------------------------------------

const IMAGE_ROLES = {
  base: 'the picture being edited',
  mark: 'the same picture with red numbered circles that mark where to change',
  ref: 'a reference picture',
} as const

async function plannerImages(req: DrawRequest) {
  const out: Array<{ url: string; role: string }> = []
  for (const img of req.imgs) {
    // A 512 px JPEG is plenty to tell the items apart and uploads fast.
    const blob =
      (await getImageBlob(img.id, 'thumb')) ??
      (await getImageBlob(img.id, 'full'))
    if (!blob) continue
    try {
      const url = await blobToDataUrl(await smallJpeg(blob))
      out.push({ url, role: IMAGE_ROLES[img.kind] })
    } catch {
      // The planner can still decide from the words.
    }
  }
  return out
}

/** Asks the planner models in turn until one answers or the time is up. */
async function plan(req: DrawRequest): Promise<DrawPlanResult | null> {
  const models = env?.planModels ?? []
  if (!models.length) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PLAN_TIMEOUT_MS)
  try {
    const images = await plannerImages(req)
    for (const model of models) {
      if (ctrl.signal.aborted) break
      try {
        const result = await planPictures({
          model,
          text: req.text,
          images,
          signal: ctrl.signal,
        })
        if (result) return result
      } catch {
        // Try the next model while there is time.
      }
    }
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function resultMessage(roomId: string, msgId: string) {
  const room = useDrawStore.getState().rooms.find((r) => r.id === roomId)
  const msg = room?.msgs.find((m) => m.id === msgId)
  return msg?.role === 'ai' ? msg : null
}

function setPlan(
  roomId: string,
  msgId: string,
  patch: Partial<DrawResultMessage>
) {
  useDrawStore.getState().updateRoom(roomId, (room) => ({
    ...room,
    msgs: room.msgs.map((m) =>
      m.id === msgId && m.role === 'ai' ? { ...m, ...patch } : m
    ),
  }))
}

/** The request drawn as one picture, with the user's own words. */
export function drawAsOne(roomId: string, msgId: string) {
  const msg = resultMessage(roomId, msgId)
  if (!msg?.req) return
  setPlan(roomId, msgId, { plan: undefined })
  startDrawing({
    roomId,
    msgId,
    req: msg.req,
    parent: msg.parent ?? null,
    est: msg.est ?? 0,
  })
}

/** Starts one picture per part; the first one goes on the canvas. */
export function drawParts(
  roomId: string,
  msgId: string,
  parts: DrawPlanPart[]
) {
  const msg = resultMessage(roomId, msgId)
  const req = msg?.req
  if (!msg || !req) return
  if (parts.length < 2) {
    if (parts.length === 1) {
      setPlan(roomId, msgId, { req: { ...req, text: parts[0].text } })
    }
    drawAsOne(roomId, msgId)
    return
  }
  setPlan(roomId, msgId, {
    plan: { ...(msg.plan ?? { capped: false }), status: 'drawn', parts },
  })
  parts.forEach((part, i) =>
    startDrawing({
      roomId,
      msgId,
      req: { ...req, text: part.text },
      parent: msg.parent ?? null,
      est: msg.est ?? 0,
      part: { i: i + 1, title: part.title },
      select: i === 0,
    })
  )
}

/**
 * Plans a sent message, then draws it: one picture as before, two at once,
 * or a plan of three or more that waits for 开始画. `balanceUsd` is the
 * balance when it was sent (null when unknown).
 */
export async function planAndDraw(
  roomId: string,
  msgId: string,
  balanceUsd: number | null
) {
  const msg = resultMessage(roomId, msgId)
  if (!msg?.req) return
  const result = await plan(msg.req)
  // The conversation was deleted while planning.
  if (!resultMessage(roomId, msgId)) return
  if (!result || result.parts.length < 2) {
    drawAsOne(roomId, msgId)
    return
  }
  const total = (msg.est ?? 0) * result.parts.length
  const held = heldCostOf(useDrawStore.getState().rooms)
  const short = balanceUsd != null && balanceUsd - held < total
  setPlan(roomId, msgId, {
    plan: { status: 'confirm', parts: result.parts, capped: result.capped },
  })
  // Three or more, or not enough balance for all: wait for 开始画.
  if (result.parts.length >= CONFIRM_FROM || short) return
  drawParts(roomId, msgId, result.parts)
}
