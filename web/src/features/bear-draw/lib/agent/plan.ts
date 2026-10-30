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
  Attachment,
  CanvasNode,
  Part,
  PictureJob,
  PlanItem,
  ProgressItem,
  Project,
  Ratio,
} from '../../types'
import { findPromptAdLaw } from '../adlaw'
import { drawPicture, estimatePicture, type PictureOutcome } from '../pictures'
import { addGroup, addPart, edit, editPart } from '../project-edit'
import type { PlanArgsT } from './tools'

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

function wantsLogo(prompt: string): boolean {
  return /logo|标志|商标|品牌标/i.test(prompt)
}

/** Stored pictures to send for one item, in the order the prompt refers to them. */
export function itemInputs(p: Project, item: PlanItem, refs: Attachment[]) {
  const ids: string[] = []
  const roles: string[] = []
  if (item.base) {
    const node = p.nodes.find((n) => n.id === item.base && n.img)
    if (node?.img) {
      ids.push(node.img.id)
      roles.push('the picture to edit')
      const marked = refs.find((r) => r.marked && r.nodeId === node.id)
      if (marked) {
        ids.push(marked.id)
        roles.push(
          'the same picture with red numbered circles marking where to change (a guide only; never draw the circles)'
        )
      }
    }
  }
  for (const n of item.refs ?? []) {
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
    !ids.includes(kit.logo.id)
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
  const ready = new Set(
    (p?.nodes ?? []).filter((n) => n.status === 'ready').map((n) => n.id)
  )
  const items = args.items.map((it, i): PlanItem => {
    const base = it.base && ready.has(it.base) ? it.base : undefined
    const item: PlanItem = {
      id: newId('it'),
      label: it.label || `#${i + 1}`,
      prompt: it.prompt,
      ratio: it.ratio,
      size: it.size || undefined,
      model,
      transparent: it.transparent || undefined,
      refs: it.refs.filter((n) => n <= refs.length),
      base,
      note: it.note || undefined,
      est: 0,
      on: true,
    }
    const inputs = p ? itemInputs(p, item, refs).ids.length : 0
    item.est =
      estimatePicture(model, {
        edit: inputs > 0,
        refs: inputs,
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
  }>
  cost: number
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
  const todo = plan.items.filter((x) => x.on)
  const groupId = newId('g')
  const nodes: CanvasNode[] = []
  const items: ProgressItem[] = []
  const jobs: PictureJob[] = []
  for (const it of todo) {
    const nodeId = newId('n')
    const [w, h] = ratioSize(it.ratio)
    const inputs = itemInputs(p, it, refs)
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
      return {
        label: it.label,
        node_id: it.nodeId,
        status,
        ...(it.error?.message ? { error: it.error.message.slice(0, 160) } : {}),
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
