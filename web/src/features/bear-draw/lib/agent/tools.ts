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
import { z } from 'zod'

import { MAX_PLAN_ITEMS, RATIOS } from '../../constants'
import type { QuestionItem, Ratio } from '../../types'

/*
 * The planner's tools. Names avoid the ones New API or the upstream treat specially
 * (image_generation, web_search, web_fetch, code_execution, tool_search).
 * The browser runs every tool: load_skill reads a bundled SKILL.md,
 * ask_user shows a question card, propose_plan shows the plan card and
 * draws, suggest_next ends the turn with "↳" follow-ups.
 */

export const TOOL_NAMES = [
  'load_skill',
  'ask_user',
  'propose_plan',
  'suggest_next',
] as const
export type ToolName = (typeof TOOL_NAMES)[number]

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'load_skill',
      description:
        'Read the full playbook of one design skill from the skill list (workflow, deliverables, prompt patterns). Call it before planning when the request matches a skill.',
      parameters: {
        type: 'object',
        properties: {
          skill_id: { type: 'string', description: 'Skill id from the list.' },
        },
        required: ['skill_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description:
        'Show the user a card with 1-3 multiple-choice questions and wait for the answers. Only for missing facts that change the result; never for simple single-picture requests.',
      parameters: {
        type: 'object',
        properties: {
          intro: {
            type: 'string',
            description: 'One short sentence above the card.',
          },
          questions: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                options: {
                  type: 'array',
                  minItems: 2,
                  maxItems: 5,
                  items: { type: 'string' },
                },
                multi: {
                  type: 'boolean',
                  description: 'Several options may be picked.',
                },
                allow_other: {
                  type: 'boolean',
                  description: 'Offer a free-text answer too.',
                },
              },
              required: ['question', 'options'],
            },
          },
        },
        required: ['questions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_plan',
      description: `Show the plan card listing every picture to draw (one item = one picture, at most ${MAX_PLAN_ITEMS}) with its price. Small plans start at once; bigger ones wait for the user to confirm. Returns which pictures were drawn, with their canvas ids.`,
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description:
              'Short name of this set, e.g. "保温杯 · 淘宝主图". Becomes the canvas frame title.',
          },
          platform: {
            type: 'string',
            description: 'Target platform if any, e.g. 淘宝, 小红书.',
          },
          items: {
            type: 'array',
            minItems: 1,
            maxItems: MAX_PLAN_ITEMS,
            items: {
              type: 'object',
              properties: {
                label: {
                  type: 'string',
                  description:
                    'Short name, e.g. 首图, 卖点图 (≤ 8 characters).',
                },
                prompt: {
                  type: 'string',
                  description:
                    'Complete, self-contained description for the image model (any language). Quote in-picture text exactly.',
                },
                ratio: {
                  type: 'string',
                  enum: RATIOS.filter((r) => r !== 'auto'),
                },
                size: {
                  type: 'string',
                  description:
                    'Delivery size such as 800×800; export crops to it.',
                },
                transparent: {
                  type: 'boolean',
                  description:
                    'Transparent background (stickers, logos, cut-outs).',
                },
                refs: {
                  type: 'array',
                  items: { type: 'integer' },
                  description:
                    'Numbers of the user pictures to use as references (Picture 1 = 1). Use them for every picture of the same product.',
                },
                base: {
                  type: 'string',
                  description:
                    'Canvas id of an existing picture to edit (e.g. n_abc). The prompt then says what to change and what to keep.',
                },
                note: {
                  type: 'string',
                  description:
                    'One short line for the user about this picture.',
                },
              },
              required: ['label', 'prompt', 'ratio'],
            },
          },
        },
        required: ['title', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_next',
      description:
        'End your turn with 3 short follow-up suggestions the user can click (each a concrete change, ≤ 16 characters).',
      parameters: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: { type: 'string' },
          },
        },
        required: ['suggestions'],
      },
    },
  },
]

/* ---------- reading the model's arguments (models drift; be forgiving) ---------- */

const str = (max: number) =>
  z
    .unknown()
    .transform((v) => (typeof v === 'string' ? v.trim().slice(0, max) : ''))

const ratioOf = (v: unknown): Ratio => {
  const s = typeof v === 'string' ? v.replaceAll(/[：x×/]/g, ':').trim() : ''
  return (RATIOS as string[]).includes(s) && s !== 'auto' ? (s as Ratio) : '1:1'
}

const SkillArgs = z.object({ skill_id: str(80) })

const QuestionArgs = z.object({
  question: str(200),
  options: z
    .array(z.unknown())
    .catch([])
    .transform((list) =>
      list
        .filter((o): o is string => typeof o === 'string' && o.trim() !== '')
        .map((o) => o.trim().slice(0, 60))
        .slice(0, 5)
    ),
  multi: z.boolean().catch(false).optional(),
  allow_other: z.boolean().catch(true).optional(),
})

const AskArgs = z.object({
  intro: str(300).optional(),
  questions: z.array(QuestionArgs).catch([]),
})

const PlanItemArgs = z.object({
  label: str(16),
  prompt: str(4000),
  ratio: z.unknown().transform(ratioOf),
  size: str(20).optional(),
  transparent: z.boolean().catch(false).optional(),
  refs: z
    .array(z.unknown())
    .catch([])
    .optional()
    .transform((list) =>
      (list ?? [])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  base: str(40).optional(),
  note: str(80).optional(),
})

const PlanArgs = z.object({
  title: str(40),
  platform: str(20).optional(),
  items: z.array(PlanItemArgs).catch([]),
})

const SuggestArgs = z.object({
  suggestions: z
    .array(z.unknown())
    .catch([])
    .transform((list) =>
      list
        .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
        .map((s) => s.trim().slice(0, 40))
        .slice(0, 3)
    ),
})

export type PlanArgsT = z.infer<typeof PlanArgs>

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    // Some models wrap the JSON in text; take the outermost object.
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      return JSON.parse(m[0])
    } catch {
      return null
    }
  }
}

export type ParsedCall =
  | { name: 'load_skill'; args: { skill_id: string } }
  | { name: 'ask_user'; args: { intro?: string; questions: QuestionItem[] } }
  | { name: 'propose_plan'; args: PlanArgsT }
  | { name: 'suggest_next'; args: { suggestions: string[] } }
  | { name: 'unknown'; error: string }

/** Reads one tool call; bad arguments come back as `unknown` with a reason for the model. */
export function parseCall(name: string, raw: string): ParsedCall {
  const data = parseJson(raw)
  if (data == null || typeof data !== 'object') {
    return {
      name: 'unknown',
      error: `Arguments of ${name} are not valid JSON.`,
    }
  }
  switch (name) {
    case 'load_skill': {
      const r = SkillArgs.safeParse(data)
      if (!r.success || !r.data.skill_id) {
        return { name: 'unknown', error: 'load_skill needs skill_id.' }
      }
      return { name, args: r.data }
    }
    case 'ask_user': {
      const r = AskArgs.safeParse(data)
      const questions = (r.success ? r.data.questions : [])
        .filter((q) => q.question && q.options.length >= 2)
        .slice(0, 3)
        .map((q): QuestionItem => ({
          q: q.question,
          options: q.options,
          multi: q.multi ?? false,
          other: q.allow_other ?? true,
        }))
      if (!r.success || !questions.length) {
        return {
          name: 'unknown',
          error: 'ask_user needs 1-3 questions, each with 2-5 options.',
        }
      }
      return { name, args: { intro: r.data.intro || undefined, questions } }
    }
    case 'propose_plan': {
      const r = PlanArgs.safeParse(data)
      const items = r.success
        ? r.data.items.filter((it) => it.prompt).slice(0, MAX_PLAN_ITEMS)
        : []
      if (!r.success || !items.length) {
        return {
          name: 'unknown',
          error: 'propose_plan needs items, each with label, prompt and ratio.',
        }
      }
      return { name, args: { ...r.data, items } }
    }
    case 'suggest_next': {
      const r = SuggestArgs.safeParse(data)
      return {
        name,
        args: { suggestions: r.success ? r.data.suggestions : [] },
      }
    }
    default:
      return { name: 'unknown', error: `There is no tool called ${name}.` }
  }
}
