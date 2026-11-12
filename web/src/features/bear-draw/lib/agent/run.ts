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
import { costOfUsage } from '@/features/bear-chat/lib/cost'
import { classifyError } from '@/features/bear-chat/lib/errors'
import { ChatRequestError } from '@/features/bear-chat/lib/stream'
import { useAuthStore } from '@/stores/auth-store'
import { findProject, useBearDrawStore } from '@/stores/bear-draw-store'

import { BRAIN_FALLBACKS, MAX_STEPS } from '../../constants'
import { SKILLS } from '../../data/skills'
import type { ApiMessage, ApiToolCall, LiveState, Part } from '../../types'
import { picturesEnv } from '../pictures'
import {
  addCost,
  addPart,
  agentMessage,
  edit,
  editMessage,
  editPart,
} from '../project-edit'
import { finishTurn, refreshResult } from './finish'
import { drawPlan, makePlan, needsConfirm, setPlanState } from './plan'
import { buildSystemPrompt } from './prompt'
import { loadSkillForModel } from './skills'
import { streamStep } from './stream'
import { parseCall, TOOLS } from './tools'
import { openCalls, placeToolResult, wireMessages } from './transcript'

/*
 * The agent loop. One request = one "step": the planner streams text and
 * tool calls; the browser runs the tools and sends the results back, until
 * the planner ends its turn (plain text or suggest_next). A question card or
 * a plan that needs 开始画 pauses the loop: the project is saved in that
 * state, and answering — now or after a reload — resumes it from the
 * transcript.
 */

type Run = {
  projectId: string
  messageId: string
  /** The account that started it; its requests go out as that account only. */
  uid: number | null
  ctrl: AbortController
  stopped: boolean
  steps: number
}

const runs = new Map<string, Run>()
let chatModels: string[] = []

export function setAgentModels(models: string[]) {
  chatModels = models
}

export function activeRun(projectId: string): Run | null {
  return runs.get(projectId) ?? null
}

export function setLive(
  projectId: string,
  phase: LiveState['phase'] | null,
  model?: string
) {
  const store = useBearDrawStore.getState()
  if (!phase) {
    store.setLive(projectId, null)
    return
  }
  const prev = store.live[projectId]
  if (prev?.phase === phase && prev.model === model) return
  // The clock runs for the whole stretch of work; time spent waiting for
  // the user (a card) doesn't count.
  const keep = prev && prev.phase !== 'wait' && phase !== 'wait'
  const now = Date.now()
  store.setLive(projectId, {
    phase,
    since: keep ? prev.since : now,
    phaseSince: prev?.phase === phase ? (prev.phaseSince ?? now) : now,
    model,
  })
}

function pushTranscript(projectId: string, ...msgs: ApiMessage[]) {
  edit(projectId, (p) => ({ ...p, transcript: [...p.transcript, ...msgs] }))
}

/** A tool call's result, in its place (replacing an earlier one). */
export function setToolResult(
  projectId: string,
  callId: string,
  content: unknown
) {
  const text = JSON.stringify(content)
  edit(projectId, (p) => {
    const next = placeToolResult(p.transcript, callId, text)
    return next === p.transcript ? p : { ...p, transcript: next }
  })
}

/** Gives every call still waiting for a result this one (e.g. stopped). */
export function closeOpenCalls(projectId: string, content: unknown) {
  const p = findProject(projectId)
  for (const id of p ? openCalls(p.transcript) : []) {
    setToolResult(projectId, id, content)
  }
}

/** Models to try for this step: the chosen one, then fallbacks the user can call. */
function modelChain(): string[] {
  const chosen = useBearDrawStore.getState().prefs.brain
  const list = [chosen, ...BRAIN_FALLBACKS].filter(
    (m, i, all) =>
      all.indexOf(m) === i && (!chatModels.length || chatModels.includes(m))
  )
  return list.length ? list : [chosen]
}

function allSkills() {
  return [...SKILLS, ...useBearDrawStore.getState().mySkills]
}

type StepOutcome =
  | { kind: 'ok'; text: string; toolCalls: ApiToolCall[]; model: string }
  | { kind: 'error'; error: ChatRequestError; model: string }
  | { kind: 'aborted' }

/** One request to the planner, streaming its text into a text part. */
async function step(run: Run): Promise<StepOutcome> {
  const p = findProject(run.projectId)
  if (!p) return { kind: 'aborted' }
  const store = useBearDrawStore.getState()
  const system = buildSystemPrompt({
    skills: allSkills(),
    project: p,
    brand: store.prefs.brand ? store.brandKit : null,
  })
  const messages = await wireMessages(system, p.transcript)
  const chain = modelChain()
  let lastError: ChatRequestError | null = null
  let swapPart: string | null = null
  for (const [i, model] of chain.entries()) {
    if (run.stopped || ownerLeft(run)) return { kind: 'aborted' }
    if (i > 0) {
      // One line that follows the switches, not one line per model.
      const text = {
        key: '{{from}} is busy right now, switched to {{to}}',
        params: { from: chain[0], to: model },
      }
      if (swapPart) {
        const id = swapPart
        editPart(run.projectId, id, 'status', (x) => ({ ...x, text }))
      } else {
        swapPart = addPart(run.projectId, run.messageId, {
          type: 'status',
          icon: 'swap',
          text,
        }).id
      }
    }
    setLive(run.projectId, 'think', model)
    const thinking = addPart<Extract<Part, { type: 'status' }>>(
      run.projectId,
      run.messageId,
      { type: 'status', icon: 'think', text: { key: 'Thinking…' }, live: true }
    )
    let textPartId: string | null = null
    let shown = ''
    const dropThinking = () =>
      editMessage(run.projectId, run.messageId, (m) => ({
        ...m,
        parts: m.parts.filter((x) => x.id !== thinking.id),
      }))
    try {
      const result = await streamStep(
        {
          model,
          stream: true,
          stream_options: { include_usage: true },
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
          temperature: 0.4,
        },
        {
          signal: run.ctrl.signal,
          onEvent: (ev) => {
            if (ev.type === 'text') {
              shown += ev.text
              if (!textPartId) {
                dropThinking()
                textPartId = addPart(run.projectId, run.messageId, {
                  type: 'text',
                  text: shown,
                  streaming: true,
                }).id
              } else {
                const id = textPartId
                editPart(run.projectId, id, 'text', (x) => ({
                  ...x,
                  text: shown,
                }))
              }
              setLive(run.projectId, 'write', model)
            } else if (ev.name === 'load_skill') {
              setLive(run.projectId, 'skill', model)
            } else if (ev.name === 'propose_plan') {
              setLive(run.projectId, 'plan', model)
            } else {
              setLive(run.projectId, 'write', model)
            }
          },
        }
      )
      dropThinking()
      if (textPartId) {
        const id = textPartId
        editPart(run.projectId, id, 'text', (x) => ({
          ...x,
          text: result.text.trim(),
          streaming: false,
        }))
      }
      const env = picturesEnv()
      if (result.usage && env) {
        const usd = costOfUsage(
          env.prices.get(model),
          result.usage,
          env.groupRatio
        )
        if (usd) addCost(run.projectId, run.messageId, usd)
      }
      editMessage(run.projectId, run.messageId, (m) => ({ ...m, brain: model }))
      return {
        kind: 'ok',
        text: result.text,
        toolCalls: result.toolCalls,
        model,
      }
    } catch (error) {
      dropThinking()
      if (
        run.stopped ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        if (textPartId) {
          const id = textPartId
          editPart(run.projectId, id, 'text', (x) => ({
            ...x,
            streaming: false,
          }))
        }
        return { kind: 'aborted' }
      }
      const err =
        error instanceof ChatRequestError
          ? error
          : new ChatRequestError(
              error instanceof Error ? error.message : 'Request failed',
              { early: !shown }
            )
      lastError = err
      if (textPartId) {
        const id = textPartId
        editPart(run.projectId, id, 'text', (x) => ({ ...x, streaming: false }))
      }
      const view = classifyError({
        message: err.message,
        code: err.code,
        status: err.status,
      })
      const retryable = ['model', 'busy', 'upstream', 'network'].includes(
        view.kind
      )
      // Only switch models before anything was said; then the step is unchanged.
      if (!err.early || !retryable || shown) {
        return { kind: 'error', error: err, model }
      }
    }
  }
  // Every model failed: no "switched to …" line, and name the chosen one.
  if (swapPart) {
    const id = swapPart
    editMessage(run.projectId, run.messageId, (m) => ({
      ...m,
      parts: m.parts.filter((x) => x.id !== id),
    }))
  }
  return {
    kind: 'error',
    error: lastError ?? new ChatRequestError('Request failed', { early: true }),
    model: chain[0] ?? '',
  }
}

function showError(run: Run, error: ChatRequestError, model: string) {
  const view = classifyError({
    message: error.message,
    code: error.code,
    status: error.status,
  })
  addPart(run.projectId, run.messageId, {
    type: 'error',
    kind: view.kind,
    message: error.message.slice(0, 300),
    model,
  })
  finishTurn(run.projectId, run.messageId, 'error')
  setLive(run.projectId, null)
  runs.delete(run.projectId)
}

type CallResult = { content: unknown; pause?: boolean; end?: boolean }

async function runTool(run: Run, call: ApiToolCall): Promise<CallResult> {
  const parsed = parseCall(call.function.name, call.function.arguments)
  switch (parsed.name) {
    case 'load_skill': {
      setLive(run.projectId, 'skill')
      const content = await loadSkillForModel(
        run.projectId,
        run.messageId,
        parsed.args.skill_id
      )
      return { content }
    }
    case 'ask_user': {
      addPart(run.projectId, run.messageId, {
        type: 'questions',
        callId: call.id,
        intro: parsed.args.intro,
        items: parsed.args.questions,
        answers: null,
      })
      return { content: null, pause: true }
    }
    case 'propose_plan': {
      const plan = makePlan(run.projectId, run.messageId, call.id, parsed.args)
      const env = picturesEnv()
      const waits = needsConfirm(plan, currentBalance())
      const part = addPart<Extract<Part, { type: 'plan' }>>(
        run.projectId,
        run.messageId,
        {
          ...plan,
          state: waits ? 'pending' : 'auto',
        }
      )
      if (waits || !env) return { content: null, pause: true }
      setLive(run.projectId, 'draw')
      const drawn = await drawPlan(run.projectId, run.messageId, part)
      return { content: { status: 'drawn', ...drawn } }
    }
    case 'suggest_next': {
      editMessage(run.projectId, run.messageId, (m) => ({
        ...m,
        suggestions: parsed.args.suggestions,
      }))
      return { content: { ok: true }, end: true }
    }
    default:
      return { content: { error: parsed.error } }
  }
}

let balanceOf: () => number | null = () => null
export function setBalanceSource(fn: () => number | null) {
  balanceOf = fn
}
function currentBalance(): number | null {
  return balanceOf()
}

/** Runs steps until the planner ends its turn, pauses for the user, or fails. */
export async function loop(run: Run): Promise<void> {
  runs.set(run.projectId, run)
  editMessage(run.projectId, run.messageId, (m) => ({
    ...m,
    status: 'running',
  }))
  while (!run.stopped) {
    if (run.steps >= MAX_STEPS) {
      addPart(run.projectId, run.messageId, {
        type: 'status',
        icon: 'info',
        text: { key: 'Stopped after too many steps. Tell me how to continue.' },
      })
      break
    }
    run.steps++
    const out = await step(run)
    if (out.kind === 'aborted') return
    if (out.kind === 'error') {
      showError(run, out.error, out.model)
      return
    }
    pushTranscript(run.projectId, {
      role: 'assistant',
      content: out.text || null,
      ...(out.toolCalls.length ? { tool_calls: out.toolCalls } : {}),
    })
    if (!out.toolCalls.length) break
    let end = false
    for (const call of out.toolCalls) {
      if (run.stopped || ownerLeft(run)) return
      const res = await runTool(run, call)
      if (res.pause) {
        editMessage(run.projectId, run.messageId, (m) => ({
          ...m,
          status: 'waiting',
        }))
        setLive(run.projectId, 'wait')
        runs.delete(run.projectId)
        return
      }
      setToolResult(run.projectId, call.id, res.content)
      if (run.stopped) {
        // Pictures that were already drawing finished after ■.
        refreshResult(run.projectId, run.messageId)
        return
      }
      if (res.end) end = true
    }
    if (end) break
  }
  if (run.stopped) return
  finishTurn(run.projectId, run.messageId, 'done')
  setLive(run.projectId, null)
  runs.delete(run.projectId)
}

export function newRun(projectId: string, messageId: string): Run {
  return {
    projectId,
    messageId,
    uid: useBearDrawStore.getState().uid,
    ctrl: new AbortController(),
    stopped: false,
    steps: 0,
  }
}

/**
 * Gives a paused tool call its result and continues the turn. Other calls
 * of the same planner message that are still open are run first. `after`
 * (pictures the user sent with the answer) follows the results.
 */
export async function resume(
  projectId: string,
  messageId: string,
  callId: string,
  content: unknown,
  after: ApiMessage[] = []
) {
  setToolResult(projectId, callId, content)
  const run = newRun(projectId, messageId)
  runs.set(projectId, run)
  editMessage(projectId, messageId, (m) => ({ ...m, status: 'running' }))
  // Calls after the paused one in the same message (rare): run them now.
  const p = findProject(projectId)
  const open = p ? openCalls(p.transcript) : []
  let last: ApiMessage | undefined
  for (const m of p?.transcript ?? []) if (m.role === 'assistant') last = m
  // Their results still land before it (placeToolResult, repairTranscript).
  if (after.length) pushTranscript(projectId, ...after)
  for (const id of open) {
    const call =
      last?.role === 'assistant'
        ? last.tool_calls?.find((c) => c.id === id)
        : undefined
    if (!call) continue
    if (ownerLeft(run)) return
    const res = await runTool(run, call)
    if (res.pause) {
      editMessage(projectId, messageId, (m) => ({ ...m, status: 'waiting' }))
      setLive(projectId, 'wait')
      runs.delete(projectId)
      return
    }
    setToolResult(projectId, call.id, res.content)
    if (res.end) {
      finishTurn(projectId, messageId, 'done')
      setLive(projectId, null)
      runs.delete(projectId)
      return
    }
  }
  await loop(run)
}

/**
 * The account that started the run signed out, or another one signed in
 * (the page is not reloaded): stop it before it sends anything more under
 * the new account.
 */
function ownerLeft(run: Run): boolean {
  if (run.uid != null && useAuthStore.getState().auth.user?.id === run.uid) {
    return false
  }
  if (runs.get(run.projectId) === run) runs.delete(run.projectId)
  run.stopped = true
  run.ctrl.abort()
  closeOpenCalls(run.projectId, { status: 'interrupted' })
  finishTurn(run.projectId, run.messageId, 'stopped')
  setLive(run.projectId, null)
  return true
}

/** Stops the turn: aborts the request, queued pictures stay unsent. */
export function stopRun(projectId: string) {
  const run = runs.get(projectId)
  if (run) {
    run.stopped = true
    run.ctrl.abort()
    runs.delete(projectId)
  }
}

export function messageOf(projectId: string, messageId: string) {
  return agentMessage(findProject(projectId), messageId)
}

export { setPlanState }
