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
import { toast } from 'sonner'

import { revokeImageUrls } from '@/features/draw/lib/images'
import { deleteImages } from '@/features/draw/lib/storage'
import { findProject, newId, useBearDrawStore } from '@/stores/bear-draw-store'

import type {
  AgentMessage,
  Attachment,
  Mode,
  Part,
  Project,
  QuestionAnswer,
  UserMessage,
} from '../types'
import { applyAdLawFixes } from './adlaw'
import { finishTurn, refreshResult } from './agent/finish'
import { drawPlan, setPlanState } from './agent/plan'
import {
  activeRun,
  closeOpenCalls,
  loop,
  newRun,
  resume,
  setLive,
  setToolResult,
  stopRun,
} from './agent/run'
import { findSkill, loadSkillForModel } from './agent/skills'
import { userTurnText } from './agent/transcript'
import { storeFiles, storeDataUrl } from './attachments'
import { imageTurns, runImageTurn, titleFrom } from './image-turn'
import { drawPicture, estimatePicture as estimate } from './pictures'
import {
  addMessage,
  addPart,
  agentMessage,
  edit,
  editMessage,
  editNode,
  editPart,
  editProgressItem,
  findPart,
} from './project-edit'
import { imageIdsOf, removeProjectRecord } from './storage'

/*
 * What the page can ask the engine to do. The engine runs outside React
 * (the agent and the pictures keep going when the user leaves the page)
 * and writes everything into stores/bear-draw-store.ts.
 */

export { onPictureFinished, type PictureFinished } from './pictures'

export type SendInput = {
  text: string
  mode: Mode
  refs: Attachment[]
  skillId?: string
  presetId?: string
}

/** Pictures being drawn again, per project (they keep the bear busy). */
const retrying = new Map<string, number>()

/** Bumped by stop(); work that started before a stop doesn't carry on. */
const stopEpoch = new Map<string, number>()
const epochOf = (projectId: string) => stopEpoch.get(projectId) ?? 0

export function createProject(title?: string): Project {
  const now = Date.now()
  const p: Project = {
    id: newId('p'),
    title: title ?? '',
    createdAt: now,
    updatedAt: now,
    cost: 0,
    messages: [],
    transcript: [],
    groups: [],
    nodes: [],
    camera: null,
  }
  useBearDrawStore.getState().putProject(p)
  return p
}

/** True while the agent of this project thinks or draws (not while it waits for you). */
export function isBusy(projectId: string): boolean {
  if (activeRun(projectId) || imageTurns(projectId) > 0) return true
  if ((retrying.get(projectId) ?? 0) > 0) return true
  const p = findProject(projectId)
  return Boolean(
    p?.messages.some((m) => m.role === 'agent' && m.status === 'running')
  )
}

function clearLiveIfIdle(projectId: string) {
  const idle =
    !activeRun(projectId) &&
    imageTurns(projectId) === 0 &&
    (retrying.get(projectId) ?? 0) === 0
  if (idle) {
    const p = findProject(projectId)
    const waiting = p?.messages.some(
      (m) => m.role === 'agent' && m.status === 'waiting'
    )
    setLive(projectId, waiting ? 'wait' : null)
  }
}

function newAgentMessage(projectId: string): AgentMessage {
  const m: AgentMessage = {
    id: newId('m'),
    role: 'agent',
    mode: 'agent',
    parts: [],
    status: 'running',
    startedAt: Date.now(),
    cost: 0,
  }
  addMessage(projectId, m)
  return m
}

/** The agent message waiting on a card, with that card. */
function waitingCard(p: Project | null) {
  const m = [...(p?.messages ?? [])].reverse().find((x) => x.role === 'agent')
  if (!m || m.role !== 'agent' || m.status !== 'waiting') return null
  const card = [...m.parts]
    .reverse()
    .find(
      (x) =>
        (x.type === 'questions' && !x.answers && !x.skipped) ||
        (x.type === 'plan' && x.state === 'pending')
    )
  return card ? { message: m, card } : null
}

function userMessageOf(input: SendInput): UserMessage {
  const store = useBearDrawStore.getState()
  const prefs = store.prefs
  return {
    id: newId('m'),
    role: 'user',
    at: Date.now(),
    mode: input.mode,
    text: input.text.trim(),
    refs: input.refs,
    skillId: input.skillId,
    presetId: input.presetId,
    brand: input.mode === 'agent' && prefs.brand && Boolean(store.brandKit),
    ...(input.mode === 'image'
      ? {
          image: {
            model: prefs.image,
            ratio: prefs.ratio,
            count: prefs.count,
            transparent: prefs.transparent,
          },
        }
      : {}),
  }
}

async function startAgentTurn(projectId: string, user: UserMessage) {
  const message = newAgentMessage(projectId)
  const store = useBearDrawStore.getState()
  const skill = user.skillId ? findSkill(user.skillId) : null
  const brand = user.brand ? (store.brandKit?.name ?? null) : null
  edit(projectId, (p) => ({
    ...p,
    transcript: [
      ...p.transcript,
      {
        role: 'user',
        content: userTurnText(user, { skill, brand }),
        ...(user.refs.length ? { images: user.refs.map((r) => r.id) } : {}),
      },
    ],
  }))
  if (brand) {
    addPart(projectId, message.id, {
      type: 'status',
      icon: 'brand',
      text: { key: 'Using the brand kit “{{name}}”', params: { name: brand } },
    })
  }
  // A skill picked with "/" is read up front, as if the planner had asked for it.
  if (skill) {
    setLive(projectId, 'skill')
    const callId = `pre_${message.id}`
    const content = await loadSkillForModel(projectId, message.id, skill.id)
    edit(projectId, (p) => ({
      ...p,
      transcript: [
        ...p.transcript,
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: callId,
              type: 'function',
              function: {
                name: 'load_skill',
                arguments: JSON.stringify({ skill_id: skill.id }),
              },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: callId,
          content: JSON.stringify(content),
        },
      ],
    }))
  }
  if (user.refs.length) {
    addPart(projectId, message.id, {
      type: 'status',
      icon: 'scan',
      text: {
        key: 'Looked at your {{count}} pictures',
        params: { count: user.refs.length },
      },
    })
  }
  await loop(newRun(projectId, message.id))
  clearLiveIfIdle(projectId)
}

/**
 * Sends a message. Agent mode: the planner answers (it may ask a question
 * card or show a plan). Image mode: draws `prefs.count` pictures at once.
 * While a question card or a plan waits, Agent text answers it instead.
 * Returns false (and tells the user) when the agent is still busy.
 */
export function send(projectId: string, input: SendInput): boolean {
  const p = findProject(projectId)
  if (!p) return false
  const user = userMessageOf(input)
  if (!p.title && user.text) {
    edit(projectId, (x) => ({
      ...x,
      title: titleFrom(user.text),
      autoTitle: true,
    }))
  }
  if (input.mode === 'image') {
    addMessage(projectId, user)
    setLive(projectId, 'draw')
    void runImageTurn(projectId, user, () => clearLiveIfIdle(projectId))
    return true
  }
  const waiting = waitingCard(p)
  if (waiting) {
    addMessage(projectId, user)
    const { message, card } = waiting
    let content: unknown
    if (card.type === 'questions') {
      editPart(projectId, card.id, 'questions', (x) => ({
        ...x,
        answers: [
          { q: x.items.map((i) => i.q).join(' / '), answer: user.text },
        ],
      }))
      content = {
        answers: [{ question: '(typed by the user)', answer: user.text }],
      }
    } else {
      setPlanState(projectId, card.id, 'changed')
      content = { status: 'not_drawn', user_says: user.text }
    }
    finishTurn(projectId, message.id, 'done')
    // The rest of the turn shows under the user's words.
    const next = newAgentMessage(projectId)
    setLive(projectId, 'think')
    if (card.type === 'plan' || card.type === 'questions') {
      void resume(projectId, next.id, card.callId, content).then(() =>
        clearLiveIfIdle(projectId)
      )
    }
    return true
  }
  if (activeRun(projectId)) {
    toast(t('The agent is still working. Wait for it, or stop it first.'))
    return false
  }
  addMessage(projectId, user)
  setLive(projectId, 'think')
  void startAgentTurn(projectId, user)
  return true
}

/** Stops the agent: queued pictures are not sent (and not charged). */
export function stop(projectId: string, opts?: { quiet?: boolean }): void {
  stopEpoch.set(projectId, epochOf(projectId) + 1)
  stopRun(projectId)
  const p = findProject(projectId)
  if (!p) return
  // The planner's conversation must stay valid for the next message.
  closeOpenCalls(projectId, { status: 'stopped_by_user' })
  let queued = 0
  let drawing = 0
  for (const m of p.messages) {
    if (m.role !== 'agent') continue
    for (const part of m.parts) {
      if (part.type !== 'progress') continue
      for (const it of part.items) {
        if (it.status === 'drawing') drawing++
        if (it.status !== 'queued') continue
        queued++
        editProgressItem(projectId, part.id, it.id, { status: 'stopped' })
        editNode(projectId, it.nodeId, (n) => ({ ...n, status: 'stopped' }))
      }
    }
    if (m.status === 'running' || m.status === 'waiting') {
      for (const part of m.parts) {
        if (part.type === 'plan' && part.state === 'pending') {
          setPlanState(projectId, part.id, 'cancelled')
        }
        if (part.type === 'questions' && !part.answers) {
          editPart(projectId, part.id, 'questions', (x) => ({
            ...x,
            skipped: true,
          }))
        }
      }
      finishTurn(projectId, m.id, 'stopped')
    }
  }
  // Pictures already drawing finish on their own; the conversation is free.
  setLive(projectId, null)
  if (opts?.quiet) return
  toast(
    queued || drawing
      ? t(
          'Stopped. Pictures that had not started are not drawn and not charged; the ones already drawing will finish.'
        )
      : t('Stopped.')
  )
}

/** Answers a question card; 'skip' lets the agent go on with its own defaults. */
export function answer(
  projectId: string,
  partId: string,
  answers: QuestionAnswer[] | 'skip'
): void {
  const found = findPart(findProject(projectId), partId)
  if (!found || found.part.type !== 'questions') return
  if (found.part.answers || found.part.skipped) return
  const callId = found.part.callId
  editPart(projectId, partId, 'questions', (x) =>
    answers === 'skip' ? { ...x, skipped: true } : { ...x, answers }
  )
  const content =
    answers === 'skip'
      ? {
          skipped: true,
          hint: 'The user skipped the questions; use sensible defaults and say which ones.',
        }
      : { answers: answers.map((a) => ({ question: a.q, answer: a.answer })) }
  setLive(projectId, 'think')
  void resume(projectId, found.message.id, callId, content).then(() =>
    clearLiveIfIdle(projectId)
  )
}

/** A plan waiting for 开始画: start all ticked items, only the first one, or cancel. */
export function decide(
  projectId: string,
  partId: string,
  decision: 'start' | 'first' | 'cancel'
): void {
  const found = findPart(findProject(projectId), partId)
  if (!found || found.part.type !== 'plan' || found.part.state !== 'pending') {
    return
  }
  const messageId = found.message.id
  const callId = found.part.callId
  if (decision === 'cancel') {
    setPlanState(projectId, partId, 'cancelled')
    setToolResult(projectId, callId, { status: 'cancelled_by_user', drawn: 0 })
    finishTurn(projectId, messageId, 'done')
    clearLiveIfIdle(projectId)
    return
  }
  if (decision === 'first') {
    let first = true
    editPart(projectId, partId, 'plan', (x) => ({
      ...x,
      items: x.items.map((it) => {
        const on = it.on && first
        if (it.on) first = false
        return { ...it, on }
      }),
    }))
  }
  setPlanState(projectId, partId, 'confirmed')
  editMessage(projectId, messageId, (m) => ({ ...m, status: 'running' }))
  setLive(projectId, 'draw')
  const epoch = epochOf(projectId)
  const plan = findPart(findProject(projectId), partId)?.part
  if (!plan || plan.type !== 'plan') return
  void drawPlan(projectId, messageId, plan).then((drawn) => {
    if (epochOf(projectId) !== epoch) {
      // Stopped while drawing: record what got drawn, don't ask the planner.
      setToolResult(projectId, callId, { status: 'stopped_by_user', ...drawn })
      refreshResult(projectId, messageId)
      clearLiveIfIdle(projectId)
      return
    }
    void resume(projectId, messageId, callId, {
      status: 'drawn',
      ...drawn,
    }).then(() => clearLiveIfIdle(projectId))
  })
}

/** Ticks or unticks one picture of a waiting plan. */
export function togglePlanItem(
  projectId: string,
  partId: string,
  itemId: string,
  on: boolean
): void {
  editPart(projectId, partId, 'plan', (x) =>
    x.state !== 'pending'
      ? x
      : {
          ...x,
          items: x.items.map((it) => (it.id === itemId ? { ...it, on } : it)),
        }
  )
}

/** Replaces the words the advertising law forbids in a waiting plan. */
export function fixAdLaw(projectId: string, partId: string): void {
  editPart(projectId, partId, 'plan', (x) => ({
    ...x,
    adlawFixed: true,
    items: x.items.map((it) => {
      const hits = x.adlaw.filter((h) => h.itemId === it.id)
      return hits.length
        ? { ...it, prompt: applyAdLawFixes(it.prompt, hits) }
        : it
    }),
  }))
}

/** Draws a failed or stopped picture again (same description, same place). */
export function retryPicture(projectId: string, nodeId: string): void {
  const p = findProject(projectId)
  if (!p) return
  for (const m of p.messages) {
    if (m.role !== 'agent') continue
    for (const part of m.parts) {
      if (part.type !== 'progress') continue
      const it = part.items.find((x) => x.nodeId === nodeId)
      if (!it?.job || it.status === 'done' || it.status === 'drawing') continue
      editProgressItem(projectId, part.id, it.id, {
        status: 'queued',
        error: undefined,
      })
      editNode(projectId, nodeId, (n) => ({ ...n, status: 'pending' }))
      refreshResult(projectId, m.id)
      setLive(projectId, 'draw')
      retrying.set(projectId, (retrying.get(projectId) ?? 0) + 1)
      void drawPicture(
        { projectId, messageId: m.id, partId: part.id, itemId: it.id, nodeId },
        it.job
      ).then(() => {
        retrying.set(projectId, Math.max(0, (retrying.get(projectId) ?? 1) - 1))
        refreshResult(projectId, m.id)
        clearLiveIfIdle(projectId)
      })
      return
    }
  }
}

/** The planner failed: ask it again from the same point. */
export function retryStep(projectId: string, messageId: string): void {
  const m = agentMessage(findProject(projectId), messageId)
  if (!m || m.status !== 'error' || activeRun(projectId)) return
  editMessage(projectId, messageId, (x) => ({
    ...x,
    status: 'running',
    endedAt: undefined,
    parts: x.parts.filter(
      (part) =>
        part.type !== 'error' &&
        part.type !== 'result' &&
        !(part.type === 'status' && part.icon === 'swap')
    ),
  }))
  setLive(projectId, 'think')
  void loop(newRun(projectId, messageId)).then(() => clearLiveIfIdle(projectId))
}

/** Removes a picture from the canvas (its message keeps showing it). */
export function deletePicture(projectId: string, nodeId: string): void {
  edit(projectId, (p) => ({
    ...p,
    nodes: p.nodes.filter((n) => n.id !== nodeId),
    groups: p.groups.map((g) => {
      if (!g.children.includes(nodeId)) return g
      const children = g.children.filter((c) => c !== nodeId)
      // "5 · 淘宝" counts the pictures in the frame
      const subtitle = g.subtitle?.replace(/\d+/, String(children.length))
      return { ...g, children, subtitle }
    }),
  }))
}

export function renameProject(projectId: string, title: string): void {
  const clean = title.trim().slice(0, 40)
  if (!clean) return
  edit(projectId, (p) => ({ ...p, title: clean, autoTitle: false }))
}

/** Deletes a project and the pictures only it uses. */
export async function deleteProject(projectId: string): Promise<void> {
  const store = useBearDrawStore.getState()
  const p = findProject(projectId)
  if (!p) return
  stop(projectId, { quiet: true })
  store.removeProject(projectId)
  await removeProjectRecord(projectId).catch(() => undefined)
  // Pictures copied from the classic page still belong to its conversations.
  if (p.migrated) return
  const keep = new Set<string>()
  for (const other of useBearDrawStore.getState().projects) {
    for (const id of imageIdsOf(other)) keep.add(id)
  }
  const logo = store.brandKit?.logo?.id
  if (logo) keep.add(logo)
  const drop = [...imageIdsOf(p)].filter((id) => !keep.has(id))
  revokeImageUrls(drop)
  await deleteImages(drop).catch(() => undefined)
}

/** Puts uploaded pictures on the canvas, in the 「你的图」 frame. */
export async function uploadToCanvas(
  projectId: string,
  files: File[]
): Promise<void> {
  const stored = await storeFiles(files)
  if (!stored.length) return
  edit(projectId, (p) => {
    let group = p.groups.find((g) => g.platform === '__uploads')
    const groups = [...p.groups]
    if (!group) {
      group = {
        id: newId('g'),
        title: t('Your pictures'),
        subtitle: t('References and product photos'),
        platform: '__uploads',
        children: [],
      }
      groups.push(group)
    }
    const nodes = stored.map((a) => ({
      id: newId('n'),
      groupId: group.id,
      status: 'ready' as const,
      img: { id: a.id, w: a.w, h: a.h },
      w: a.w,
      h: a.h,
      label: (a.name ?? t('Picture')).replace(/\.\w+$/, '').slice(0, 14),
      meta: { upload: true },
    }))
    const gid = group.id
    return {
      ...p,
      nodes: [...p.nodes, ...nodes],
      groups: groups.map((g) =>
        g.id === gid
          ? { ...g, children: [...g.children, ...nodes.map((n) => n.id)] }
          : g
      ),
    }
  })
}

/**
 * Stores pictures the user attaches in the composer (upload, paste, drop)
 * and returns them as attachments. Throws when a file can't be read.
 */
export function storeAttachments(files: File[]): Promise<Attachment[]> {
  return storeFiles(files)
}

/** A canvas picture marked with red circles, stored as an attachment. */
export async function storeMarked(
  projectId: string,
  nodeId: string,
  dataUrl: string
): Promise<Attachment | null> {
  const node = findProject(projectId)?.nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const stored = await storeDataUrl(dataUrl).catch(() => null)
  if (!stored) return null
  return { ...stored, nodeId, label: node.label, marked: true }
}

/** Rough USD for one picture before it is drawn (model, edit or not). */
export function estimatePicture(
  model: string,
  opts: { edit: boolean; refs: number; transparent: boolean }
): number | null {
  return estimate(model, opts)
}

export type { Part }
