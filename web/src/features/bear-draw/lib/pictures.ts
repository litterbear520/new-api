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
import { DrawApiError, requestImage } from '@/features/draw/api'
import { costFromUsage, priceTokens } from '@/features/draw/lib/cost'
import { DrawKeyError, getDrawKey } from '@/features/draw/lib/draw-key'
import {
  copyBlob,
  prepareImage,
  primeImageUrls,
} from '@/features/draw/lib/images'
import {
  getImageBlob,
  isQuotaError,
  putImage,
  requestPersistence,
} from '@/features/draw/lib/storage'
import type { DrawErrorKind } from '@/features/draw/types'
import type { PricingModel } from '@/features/pricing/types'
import { getSelf } from '@/lib/api'
import { type AuthUser, useAuthStore } from '@/stores/auth-store'
import { findProject, newId } from '@/stores/bear-draw-store'

import { MAX_DRAWING } from '../constants'
import type { PictureJob, ProgressItem, Ratio } from '../types'
import { addCost, editNode, editProgressItem, findPart } from './project-edit'

/*
 * Pictures are drawn outside React, at most MAX_DRAWING at once; the rest
 * wait here without sending anything, so a waiting picture is never
 * charged and can still be stopped. Each finished picture is stored in
 * IndexedDB and priced from the usage the API returned.
 */

export type PicturesEnv = {
  uid: number
  imageModels: string[]
  prices: Map<string, PricingModel>
  groupRatio: number
}

export type PictureTarget = {
  projectId: string
  messageId: string
  partId: string
  itemId: string
  nodeId: string
}

export type PictureOutcome = {
  ok: boolean
  cost: number
  error?: { kind: DrawErrorKind; message?: string }
}

export type PictureFinished = {
  projectId: string
  nodeId: string
  ok: boolean
  label: string
  notSaved?: boolean
}

let env: PicturesEnv | null = null
const finishedListeners = new Set<(e: PictureFinished) => void>()

export function setPicturesEnv(next: PicturesEnv) {
  env = next
}

export function picturesEnv(): PicturesEnv | null {
  return env
}

export function onPictureFinished(fn: (e: PictureFinished) => void) {
  finishedListeners.add(fn)
  return () => {
    finishedListeners.delete(fn)
  }
}

/* ---------- queue ---------- */

let running = 0
const waiting: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (running < MAX_DRAWING) {
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

/** Pictures drawing or waiting right now, in every project. */
export function busyPictures(): number {
  return running + waiting.length
}

/* ---------- helpers ---------- */

/**
 * Tokens a picture usually takes on 小熊API (live logs 2026-10-25): the
 * output is 515 or 915 tokens whatever the ratio, an agent prompt is ~300
 * text tokens, each attached picture ~1521 image tokens, transparent ~2058.
 * A picture drawn from an input picture outputs more: median 1372 over 61
 * live pictures, 2026-10-31 to 11-06.
 */
const EST_TOKENS = {
  text: 300,
  out: 700,
  edit: 1372,
  clear: 2058,
  perImage: 1521,
}

/** Rough USD for one picture before it is drawn. */
export function estimatePicture(
  model: string,
  opts: { edit: boolean; refs: number; transparent: boolean; ratio?: Ratio }
): number | null {
  if (!env) return null
  const images = opts.edit ? Math.max(1, opts.refs) : opts.refs
  let out = EST_TOKENS.out
  if (opts.edit) out = EST_TOKENS.edit
  if (opts.transparent) out = EST_TOKENS.clear
  return priceTokens(
    env.prices.get(model),
    { p: EST_TOKENS.text, img: images * EST_TOKENS.perImage, c: out },
    env.groupRatio
  )
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

async function inputImages(ids: string[]) {
  const out: Array<{ blob: Blob; name: string }> = []
  for (const [i, id] of ids.entries()) {
    const stored = await getImageBlob(id, 'full')
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

function currentItem(t: PictureTarget): ProgressItem | null {
  const found = findPart(findProject(t.projectId), t.partId)
  if (!found || found.part.type !== 'progress') return null
  return found.part.items.find((it) => it.id === t.itemId) ?? null
}

async function callImage(job: PictureJob) {
  const e = env
  if (!e) throw new Error('Drawing is not ready')
  const images = await inputImages(job.inputs)
  const call = (key: string) =>
    requestImage({
      key,
      model: job.model,
      prompt: job.prompt,
      clear: job.transparent,
      images,
    })
  try {
    return await call(await getDrawKey(e.uid, e.imageModels))
  } catch (error) {
    // A deleted or changed token: fetch it again once.
    if (!(error instanceof DrawApiError) || error.kind !== 'auth') throw error
    return call(await getDrawKey(e.uid, e.imageModels, true))
  }
}

function emit(e: PictureFinished) {
  finishedListeners.forEach((fn) => {
    try {
      fn(e)
    } catch {
      // A listener's failure must not break drawing.
    }
  })
}

/* ---------- drawing ---------- */

async function draw(
  t: PictureTarget,
  job: PictureJob
): Promise<PictureOutcome> {
  const e = env
  if (!e) throw new Error('Drawing is not ready')
  const start = Date.now()
  editProgressItem(t.projectId, t.partId, t.itemId, {
    status: 'drawing',
    startedAt: start,
  })
  editNode(t.projectId, t.nodeId, (n) => ({
    ...n,
    status: 'pending',
    meta: { ...n.meta, startedAt: start },
  }))

  const result = await callImage(job)
  const pic = result.images[0]
  const imgId = newId('i')
  const prepared = await prepareImage(pic.blob, job.transparent)
  primeImageUrls(imgId, pic.blob, prepared.thumb)
  let notSaved = false
  try {
    await putImage(e.uid, imgId, pic.blob, prepared.thumb)
    requestPersistence()
  } catch (error) {
    notSaved = isQuotaError(error)
    if (!notSaved) throw error
  }
  // Every picture in a reply is billed, but we ask for one; extra ones are dropped.
  const cost =
    costFromUsage(e.prices.get(job.model), result.usage, e.groupRatio) ??
    estimatePicture(job.model, {
      edit: job.inputs.length > 0,
      refs: job.inputs.length,
      transparent: job.transparent,
      ratio: job.ratio,
    }) ??
    0
  const secs = Math.max(1, Math.round((Date.now() - start) / 1000))
  const img = {
    id: imgId,
    w: prepared.w,
    h: prepared.h,
    clear: job.transparent,
  }
  editProgressItem(t.projectId, t.partId, t.itemId, {
    status: 'done',
    img,
    secs,
    cost,
    error: undefined,
  })
  editNode(t.projectId, t.nodeId, (n) => ({
    ...n,
    status: 'ready',
    img,
    w: img.w,
    h: img.h,
    meta: { ...n.meta, cost, secs, model: job.model, startedAt: undefined },
  }))
  addCost(t.projectId, t.messageId, cost)
  const label = currentItem(t)?.label ?? ''
  emit({ projectId: t.projectId, nodeId: t.nodeId, ok: true, label, notSaved })
  void refreshBalance()
  return { ok: true, cost }
}

/**
 * Queues one picture. Resolves when it is done, failed or stopped; never
 * rejects. The progress item must already exist (status 'queued').
 */
export async function drawPicture(
  t: PictureTarget,
  job: PictureJob
): Promise<PictureOutcome> {
  await acquireSlot()
  try {
    const item = currentItem(t)
    // Stopped or deleted while waiting: send nothing.
    if (!item || item.status !== 'queued') {
      return { ok: false, cost: 0 }
    }
    return await draw(t, job)
  } catch (error) {
    const err = errorOf(error)
    editProgressItem(t.projectId, t.partId, t.itemId, {
      status: 'failed',
      error: err,
    })
    editNode(t.projectId, t.nodeId, (n) => ({
      ...n,
      status: 'failed',
      meta: { ...n.meta, startedAt: undefined },
    }))
    const label = currentItem(t)?.label ?? ''
    emit({ projectId: t.projectId, nodeId: t.nodeId, ok: false, label })
    return { ok: false, cost: 0, error: err }
  } finally {
    releaseSlot()
  }
}
