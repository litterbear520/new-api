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

import { findProject, newId, useBearDrawStore } from '@/stores/bear-draw-store'

import {
  CONFIRM_FROM,
  CONFIRM_USD,
  ratioHint,
  ratioSize,
} from '../../constants'
import type {
  AdLawHit,
  ApiMessage,
  Attachment,
  CanvasNode,
  InputRole,
  Part,
  PictureJob,
  PlanInput,
  PlanItem,
  ProgressItem,
  Project,
  Ratio,
} from '../../types'
import { findPromptAdLaw } from '../adlaw'
import { drawPicture, estimatePicture, type PictureOutcome } from '../pictures'
import { addGroup, addPart, edit, editPart } from '../project-edit'
import { MAX_INPUTS, type PlanArgsT } from './tools'
import { shownPictures } from './transcript'

/*
 * propose_plan: turns the planner's items into a plan card with prices and
 * advertising-law hits, and draws the ticked items when the plan starts.
 */

export type PlanPart = Extract<Part, { type: 'plan' }>

/**
 * The pictures "Picture n" refers to: those of the nearest earlier Agent
 * message that had any (a typed answer to a card has none of its own).
 */
export function turnRefs(p: Project, agentMessageId: string): Attachment[] {
  const at = p.messages.findIndex((m) => m.id === agentMessageId)
  for (let i = at - 1; i >= 0; i--) {
    const m = p.messages[i]
    if (m.role === 'user' && m.mode === 'agent' && m.refs.length) return m.refs
  }
  return []
}

/** What the red-circle copy is, in the prompt of both modes. */
export const MARKED_ROLE =
  'the same picture with red numbered circles marking where to change (a guide only; change only inside the circles and never draw them)'

/**
 * The picture an item edits. The planner's `base` wins; without one, the
 * only picture the user circled for this request is it, so its red-circle
 * copy is never left out.
 */
export function baseOf(
  base: string | undefined,
  marks: Attachment[],
  ready: Set<string>
): string | undefined {
  if (base && ready.has(base)) return base
  const circled = [
    ...new Set(
      marks
        .filter((r) => r.marked && r.nodeId && ready.has(r.nodeId))
        .map((r) => r.nodeId as string)
    ),
  ]
  return circled.length === 1 ? circled[0] : undefined
}

/**
 * The red-circle copies that belong to this request: those of the message
 * the Agent message answers. A typed answer to a card passes on to the
 * message before it; any other message without circles ends the search, so
 * the circles of an earlier request never reach a new one. The newest copy
 * of a picture comes first.
 */
export function turnMarks(p: Project, agentMessageId: string): Attachment[] {
  const at = p.messages.findIndex((m) => m.id === agentMessageId)
  for (let i = at - 1; i >= 0; i--) {
    const m = p.messages[i]
    if (m.role !== 'user' || m.mode !== 'agent') continue
    const marks = m.refs.filter((r) => r.marked)
    if (marks.length) return [...marks].reverse()
    if (!m.reply) return []
  }
  return []
}

/**
 * Several pictures are circled and no item says which one it edits: the
 * ids to ask the planner about, else null.
 */
export function unclearBase(
  p: Project,
  agentMessageId: string,
  bases: Array<string | undefined>
): string[] | null {
  const ready = new Set(
    p.nodes.filter((n) => n.status === 'ready').map((n) => n.id)
  )
  const circled = [
    ...new Set(
      turnMarks(p, agentMessageId)
        .map((r) => r.nodeId)
        .filter((id): id is string => Boolean(id && ready.has(id)))
    ),
  ]
  if (circled.length < 2) return null
  return bases.some((b) => b && circled.includes(b)) ? null : circled
}

/** The canvas picture an item's inputs change, if they name one. */
function targetOf(inputs: PlanInput[] | undefined): string | undefined {
  return inputs?.find((x) => x.role === 'edit_target' && x.node)?.node
}

/** The picture each item says it edits: its base, or the edit_target of its inputs. */
export function statedBases(args: PlanArgsT): Array<string | undefined> {
  return args.items.map((it) => it.base || targetOf(it.inputs))
}

/**
 * What is wrong with the inputs of a plan, in words for the planner, or
 * null. Nothing is dropped silently: a picture left out changes the result.
 */
export function inputProblem(
  p: Project,
  agentMessageId: string,
  args: PlanArgsT
): string | null {
  const ready = new Set(
    p.nodes.filter((n) => n.status === 'ready' && n.img).map((n) => n.id)
  )
  const refs = turnRefs(p, agentMessageId)
  const marks = turnMarks(p, agentMessageId)
  const circled = baseOf(undefined, marks, ready)
  for (const it of args.items) {
    const list = it.inputs ?? []
    if (!list.length) continue
    const name = it.label || 'an item'
    const target = targetOf(list)
    if (circled && target !== circled) {
      return `「${name}」: the user circled the canvas picture ${circled}, so it is the picture to edit. List it in inputs with the role edit_target and call propose_plan again.`
    }
    // The red-circle copy of the picture to edit is sent too.
    const sent = list.length + (marks.some((r) => r.nodeId === target) ? 1 : 0)
    if (sent > MAX_INPUTS) {
      return `「${name}」 has ${sent} input pictures${sent > list.length ? " (the copy with the user's red circles counts as one)" : ''}; a picture takes at most ${MAX_INPUTS}. Keep the ones that matter and call propose_plan again.`
    }
    if (list.filter((x) => x.role === 'edit_target').length > 1) {
      return `「${name}」 has more than one edit_target. Keep one picture to change and give the others another role (insert, product_ref, …), then call propose_plan again.`
    }
    for (const x of list) {
      if (x.node && !ready.has(x.node)) {
        return `「${name}」: there is no finished canvas picture with the id ${x.node}. Use an id from the canvas list and call propose_plan again.`
      }
      if (!x.node && (!x.ref || x.ref > refs.length)) {
        return `「${name}」: an input needs node_id or ref, and the user attached ${refs.length} picture(s) to this request. Fix it and call propose_plan again.`
      }
    }
  }
  return null
}

const ROLE_TEXT: Record<InputRole, string> = {
  edit_target: 'the picture to edit',
  product_ref:
    'the product reference: keep this exact product (shape, color, material, logo, proportions)',
  style_ref:
    'a style reference: follow its style, palette and mood only, not its content',
  logo_ref: 'the logo: place it as it is, do not redraw or restyle it',
  scene_ref: 'the scene or background to use',
  insert: 'a subject to place into the result',
}

/** The inputs of an item that names each one's role, in order. */
function roledInputs(
  p: Project,
  item: PlanItem,
  refs: Attachment[],
  marks: Attachment[]
) {
  const ids: string[] = []
  const roles: string[] = []
  let circles: { at: number; copy?: Attachment } | undefined
  for (const x of item.inputs ?? []) {
    if (x.node) {
      const node = p.nodes.find((n) => n.id === x.node && n.img)
      if (!node?.img || ids.includes(node.img.id)) continue
      ids.push(node.img.id)
      roles.push(
        x.role === 'edit_target'
          ? ROLE_TEXT.edit_target
          : `「${node.label}」, ${ROLE_TEXT[x.role]}`
      )
      if (x.role === 'edit_target') {
        circles = {
          at: ids.length,
          copy: marks.find((r) => r.nodeId === node.id),
        }
      }
      continue
    }
    const ref = x.ref ? refs[x.ref - 1] : undefined
    if (!ref || ref.marked || ids.includes(ref.id)) continue
    ids.push(ref.id)
    roles.push(ROLE_TEXT[x.role])
  }
  // The red-circle copy goes last, so "Image N" in the planner's prompt
  // still counts the inputs in the order it listed them.
  if (circles?.copy && !ids.includes(circles.copy.id)) {
    ids.push(circles.copy.id)
    roles.push(
      `a copy of Image ${circles.at} with red numbered circles marking where to change (a guide only; change only inside the circles and never draw them)`
    )
  }
  return { ids, roles }
}

function wantsLogo(prompt: string): boolean {
  return /logo|标志|商标|品牌标/i.test(prompt)
}

/** Stored pictures to send for one item, in the order the prompt refers to them. */
export function itemInputs(
  p: Project,
  item: PlanItem,
  refs: Attachment[],
  marks: Attachment[] = refs.filter((r) => r.marked)
) {
  const roled = item.inputs?.length ? roledInputs(p, item, refs, marks) : null
  const ids: string[] = roled?.ids ?? []
  const roles: string[] = roled?.roles ?? []
  if (!roled && item.base) {
    const node = p.nodes.find((n) => n.id === item.base && n.img)
    if (node?.img) {
      ids.push(node.img.id)
      roles.push('the picture to edit')
      const marked = marks.find((r) => r.nodeId === node.id)
      if (marked) {
        ids.push(marked.id)
        roles.push(MARKED_ROLE)
      }
    }
  }
  for (const n of roled ? [] : (item.refs ?? [])) {
    const ref = refs[n - 1]
    if (!ref || ids.includes(ref.id) || ref.marked) continue
    ids.push(ref.id)
    roles.push(
      ref.nodeId
        ? `reference「${ref.label ?? ''}」`
        : `reference (user picture ${n})`
    )
  }
  const kit = useBearDrawStore.getState().brandKit
  const brandOn = useBearDrawStore.getState().prefs.brand
  if (
    brandOn &&
    kit?.logo &&
    wantsLogo(item.prompt) &&
    !ids.includes(kit.logo.id) &&
    ids.length < MAX_INPUTS
  ) {
    ids.push(kit.logo.id)
    roles.push('the brand logo')
  }
  return { ids, roles }
}

/** The prompt actually sent: the planner's words + which image is which + ratio. */
export function composePrompt(
  prompt: string,
  ratio: Ratio,
  transparent: boolean,
  roles: string[]
): string {
  const lines: string[] = []
  if (roles.length) {
    lines.push(roles.map((r, i) => `Image ${i + 1} is ${r}.`).join(' '))
  }
  lines.push(prompt.trim())
  const hint = ratioHint(ratio)
  if (hint) lines.push(hint)
  if (transparent) lines.push('Transparent background.')
  return lines.join('\n')
}

/** Builds the plan card from the planner's arguments. */
export function makePlan(
  projectId: string,
  agentMessageId: string,
  callId: string,
  args: PlanArgsT
): Omit<PlanPart, 'id'> {
  const p = findProject(projectId)
  const model = useBearDrawStore.getState().prefs.image
  const refs = p ? turnRefs(p, agentMessageId) : []
  const marks = p ? turnMarks(p, agentMessageId) : []
  const ready = new Set(
    (p?.nodes ?? []).filter((n) => n.status === 'ready').map((n) => n.id)
  )
  const items = args.items.map((it, i): PlanItem => {
    // Inputs replace base and refs: with them, only they say what is edited.
    const inputs = it.inputs?.length ? it.inputs : undefined
    const base = inputs ? targetOf(inputs) : baseOf(it.base, marks, ready)
    // An edit keeps the transparency of its picture unless the planner says
    // otherwise: a canvas picture, or one the user attached.
    const target = inputs?.find((x) => x.role === 'edit_target')
    const baseClear = Boolean(
      base
        ? p?.nodes.find((n) => n.id === base)?.img?.clear
        : target?.ref && refs[target.ref - 1]?.clear
    )
    const transparent = it.transparent ?? baseClear
    const item: PlanItem = {
      id: newId('it'),
      label: it.label || `#${i + 1}`,
      prompt: it.prompt,
      ratio: it.ratio,
      size: it.size || undefined,
      model,
      transparent: transparent || undefined,
      refs: it.refs.filter((n) => n <= refs.length),
      base,
      inputs,
      note: it.note || undefined,
      est: 0,
      on: true,
    }
    const sent = p ? itemInputs(p, item, refs, marks).ids.length : 0
    item.est =
      estimatePicture(model, {
        edit: sent > 0,
        refs: sent,
        transparent: Boolean(item.transparent),
        ratio: item.ratio,
      }) ?? 0
    return item
  })
  const adlaw: AdLawHit[] = items.flatMap((it) =>
    findPromptAdLaw(it.prompt).map((m) => ({
      itemId: it.id,
      word: m.word,
      fix: m.fix,
      reason: m.reason,
    }))
  )
  return {
    type: 'plan',
    callId,
    title: args.title || items[0]?.label || '',
    platform: args.platform || undefined,
    items,
    state: 'pending',
    adlaw,
  }
}

export function planTotal(items: PlanItem[]): number {
  return items.filter((x) => x.on).reduce((s, x) => s + x.est, 0)
}

/** Small plans start at once; bigger, flagged or unaffordable ones wait for the user. */
export function needsConfirm(
  plan: Omit<PlanPart, 'id'>,
  balanceUsd: number | null
): boolean {
  const on = plan.items.filter((x) => x.on)
  const total = planTotal(plan.items)
  if (on.length >= CONFIRM_FROM || total >= CONFIRM_USD) return true
  if (plan.adlaw.length) return true
  return balanceUsd != null && balanceUsd < total
}

export type DrawnPlan = {
  groupId: string
  results: Array<{
    label: string
    node_id: string
    status: 'done' | 'failed' | 'stopped'
    error?: string
    /** Why it failed, so the planner can say what to do about it. */
    error_kind?: 'moderation' | 'balance' | 'busy' | 'unreadable' | 'other'
  }>
  cost: number
}

/** A drawn set this small goes back to the planner as pictures to check. */
export const CHECK_MAX = 4
/** Long side of the pictures sent for the check. */
export const CHECK_PX = 768

/**
 * The pictures of a drawn plan as a message for the planner, so it checks
 * them before it describes them. A bigger set is left to view_pictures.
 */
export function drawnPictures(
  projectId: string,
  drawn: DrawnPlan
): ApiMessage[] {
  const p = findProject(projectId)
  const done = drawn.results.filter((r) => r.status === 'done')
  if (!p || !done.length || done.length > CHECK_MAX) return []
  const nodes = done.flatMap((r) => {
    const n = p.nodes.find((x) => x.id === r.node_id && x.img)
    return n ? [n] : []
  })
  const message = shownPictures('drawn', nodes, CHECK_PX)
  return message ? [message] : []
}

/**
 * A picture a waiting plan was priced with is gone from the canvas (the user
 * removed it before pressing start): what to tell the planner, else null.
 */
export function lostInput(p: Project, plan: PlanPart): string | null {
  for (const it of plan.items.filter((x) => x.on)) {
    const ids = it.inputs
      ? it.inputs.flatMap((x) => (x.node ? [x.node] : []))
      : [it.base].filter((id): id is string => Boolean(id))
    const gone = ids.find((id) => !p.nodes.some((n) => n.id === id && n.img))
    if (gone) {
      return `Nothing was drawn and nothing was charged: 「${it.label}」 needs the canvas picture ${gone}, and the user removed it after the plan was made. Tell the user, and offer a plan without it.`
    }
  }
  return null
}

/** Puts the plan's frames on the canvas and draws every ticked item. */
export async function drawPlan(
  projectId: string,
  agentMessageId: string,
  plan: PlanPart
): Promise<DrawnPlan> {
  const p = findProject(projectId)
  if (!p) return { groupId: '', results: [], cost: 0 }
  const refs = turnRefs(p, agentMessageId)
  const marks = turnMarks(p, agentMessageId)
  const todo = plan.items.filter((x) => x.on)
  const groupId = newId('g')
  const nodes: CanvasNode[] = []
  const items: ProgressItem[] = []
  const jobs: PictureJob[] = []
  for (const it of todo) {
    const nodeId = newId('n')
    const [w, h] = ratioSize(it.ratio)
    const inputs = itemInputs(p, it, refs, marks)
    const job: PictureJob = {
      model: it.model,
      prompt: composePrompt(
        it.prompt,
        it.ratio,
        Boolean(it.transparent),
        inputs.roles
      ),
      transparent: Boolean(it.transparent),
      inputs: inputs.ids,
      ratio: it.ratio,
    }
    nodes.push({
      id: nodeId,
      groupId,
      status: 'pending',
      w,
      h,
      label: it.label,
      meta: { model: it.model, prompt: it.prompt, size: it.size },
    })
    items.push({
      id: it.id,
      nodeId,
      label: it.label,
      size: it.size,
      model: it.model,
      prompt: it.prompt,
      status: 'queued',
      edit: inputs.ids.length > 0,
      job,
    })
    jobs.push(job)
  }
  const subtitle = [
    t('{{count}} pictures', { count: todo.length }),
    plan.platform,
  ]
    .filter(Boolean)
    .join(' · ')
  addGroup(
    projectId,
    {
      id: groupId,
      title: plan.title,
      subtitle,
      platform: plan.platform,
      children: nodes.map((n) => n.id),
    },
    nodes
  )
  // A project named after its first message takes the name of its first plan.
  edit(projectId, (x) =>
    x.title && !x.autoTitle
      ? x
      : { ...x, title: plan.title.slice(0, 24) || x.title, autoTitle: false }
  )
  const progress = addPart<Extract<Part, { type: 'progress' }>>(
    projectId,
    agentMessageId,
    { type: 'progress', groupId, items }
  )
  const outcomes: PictureOutcome[] = await Promise.all(
    items.map((it, i) =>
      drawPicture(
        {
          projectId,
          messageId: agentMessageId,
          partId: progress.id,
          itemId: it.id,
          nodeId: it.nodeId,
        },
        jobs[i]
      )
    )
  )
  const after = findProject(projectId)
  const part = after?.messages
    .flatMap((m) => (m.role === 'agent' ? m.parts : []))
    .find((x) => x.id === progress.id)
  const finalItems = part?.type === 'progress' ? part.items : items
  return {
    groupId,
    cost: outcomes.reduce((s, o) => s + o.cost, 0),
    results: finalItems.map((it) => {
      let status: 'done' | 'failed' | 'stopped' = 'stopped'
      if (it.status === 'done') status = 'done'
      else if (it.status === 'failed') status = 'failed'
      const kind = it.error?.kind
      return {
        label: it.label,
        node_id: it.nodeId,
        status,
        ...(it.error?.message ? { error: it.error.message.slice(0, 160) } : {}),
        ...(status === 'failed' && kind
          ? {
              error_kind:
                kind === 'auth' || kind === 'lost' ? ('other' as const) : kind,
            }
          : {}),
      }
    }),
  }
}

export function setPlanState(
  projectId: string,
  partId: string,
  state: PlanPart['state']
) {
  editPart(projectId, partId, 'plan', (part) => ({ ...part, state }))
}
