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
import type { Effort, Prefs, Ratio } from './types'

export { DRAW_GUIDE_URL, DRAW_TOKEN_NAME } from '@/features/draw/constants'

/** Pictures drawing at once (shared idea with the classic page); the rest queue unsent. */
export const MAX_DRAWING = 3
/** Pictures one plan may hold. */
export const MAX_PLAN_ITEMS = 8
/** Image mode: pictures per message. */
export const MAX_COUNT = 4
/** Pictures attached to one message. */
export const MAX_REFS = 4
/** A plan waits for 开始画 from this many pictures… */
export const CONFIRM_FROM = 3
/** …or from this estimated total (USD). */
export const CONFIRM_USD = 0.1
/** Model calls in one agent turn before it gives up. */
export const MAX_STEPS = 8
/** Width of the chat pane next to the canvas (px). */
export const CHAT_W = { min: 320, max: 560, initial: 400 }
/** Below this card width the canvas opens over the chat. */
export const NARROW_CARD = 900

export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.6-sunburst'
/** The current generation, listed first; the others fold under 旧版模型. */
export const CURRENT_IMAGE_MODELS = [
  'gpt-image-2.6-sunburst',
  'gpt-image-2.6-flare',
]
/**
 * The planner. Codex has its main model call the image tool, and its
 * catalogue leads with this one; gpt-6-luna (the default until 11-26)
 * missed look-alike characters in its checks and often gave no follow-ups.
 */
export const DEFAULT_BRAIN = 'gpt-6.2-sol'

/** Image models we know: names and the menu note (i18n keys). */
export const IMAGE_MODEL_META: Record<
  string,
  { name: string; short: string; note: string; tag?: 'recommended' }
> = {
  'gpt-image-2.6-sunburst': {
    name: 'GPT Image 2.6 Sunburst',
    short: 'Sunburst 2.6',
    note: 'Best quality; text and edits come out more exact',
    tag: 'recommended',
  },
  'gpt-image-2.6-flare': {
    name: 'GPT Image 2.6 Flare',
    short: 'Flare 2.6',
    note: 'The lighter model, for everyday pictures',
  },
  'gpt-image-2.5-sunburst': {
    name: 'GPT Image 2.5 Sunburst',
    short: 'Sunburst 2.5',
    note: 'Previous generation',
  },
  'gpt-image-2.5-flare': {
    name: 'GPT Image 2.5 Flare',
    short: 'Flare 2.5',
    note: 'Previous generation',
  },
  'gpt-image-2': {
    name: 'GPT Image 2',
    short: 'Image 2',
    note: 'Previous generation',
  },
}

/**
 * Chat models known as planners, best first; notes are i18n keys (the
 * picker lists PLANNERS; use-env marks these as featured).
 */
export const BRAIN_META: Array<{ id: string; note: string; tag?: 'default' }> =
  [
    {
      id: 'gpt-6.2-sol',
      note: 'Plans more carefully, writes finer prompts',
      tag: 'default',
    },
    { id: 'gpt-6-luna', note: 'Cheap and quick, fine for everyday sets' },
    { id: 'gemini-3.8-flash', note: 'Reads reference pictures more closely' },
    { id: 'claude-sonnet-4-6', note: 'More refined copywriting' },
  ]

/** The planners offered under 「最新」, best first, with the names shown. */
export const PLANNERS: Array<{ id: string; name: string }> = [
  { id: 'gpt-6.2-sol', name: 'GPT-6.2 Sol' },
  { id: 'gpt-6.2-astra', name: 'GPT-6.2 Astra' },
  { id: 'gpt-6-luna', name: 'GPT-6 Luna' },
]

/** Thinking efforts, lightest first; labels are i18n keys. */
export const EFFORTS: Array<{ id: Effort; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'xhigh', label: 'Extra high' },
]

/** What each stop costs, in two to four characters (i18n keys). */
export const EFFORT_COST: Record<Effort, string> = {
  low: 'Faster',
  medium: 'Balanced',
  high: 'Finer',
  xhigh: 'Slower, costs more',
}

/**
 * Models whose thinking effort can be set: they get `reasoning_effort`, and
 * the slider shows for them. The others get the request without it.
 */
export const TAKES_EFFORT = /^gpt-[56]/

/**
 * What 「最新」 plans with on this account: the best of the fallback order
 * it can call, else any chat model it has.
 */
export function latestPlanner(available: string[]): string {
  if (!available.length) return DEFAULT_BRAIN
  return BRAIN_FALLBACKS.find((id) => available.includes(id)) ?? available[0]
}

/** When the chosen brain is down before it says anything, try these in order. */
export const BRAIN_FALLBACKS = [
  'gpt-6.2-sol',
  'gpt-6.1-sol',
  'gpt-6-luna',
  'gpt-5.6-luna',
  'gemini-3-flash',
  'gemini-3.8-flash',
]

/** Not offered as a brain: image models and other non-chat models. */
export const NON_CHAT_MODEL =
  /(^|[-/])(gpt-image|dall-e|imagen|flux|midjourney|seedream|kling|suno|sora|veo|tts|whisper|embedding|rerank|moderation)|-image$|-image-/i

export const RATIOS: Ratio[] = [
  'auto',
  '1:1',
  '3:4',
  '4:3',
  '2:3',
  '3:2',
  '9:16',
  '16:9',
]

/** The sentence that makes the image model follow a ratio (size is ignored upstream). */
export function ratioHint(ratio: Ratio): string {
  if (ratio === 'auto') return ''
  const names: Record<Exclude<Ratio, 'auto'>, string> = {
    '1:1': 'square',
    '3:4': 'portrait',
    '4:3': 'landscape',
    '2:3': 'portrait',
    '3:2': 'landscape',
    '9:16': 'tall portrait',
    '16:9': 'wide landscape',
  }
  return `Aspect ratio ${ratio} (${names[ratio]}).`
}

/** Width/height of a ratio, for frames that wait for their picture. */
export function ratioSize(ratio: Ratio, long = 1024): [number, number] {
  const [a, b] = (ratio === 'auto' ? '3:2' : ratio).split(':').map(Number)
  return a >= b
    ? [long, Math.round((long * b) / a)]
    : [Math.round((long * a) / b), long]
}

/**
 * Seconds a picture usually takes on 小熊API (live logs, 2026-10-25):
 * p50 / p90. Drives the waiting words, never a fake percent.
 */
export const TYPICAL_SECS: Record<
  string,
  { gen: [number, number]; edit: [number, number] }
> = {
  // live logs 2026-11-05..25: 16 plain, 18 with an input picture; Flare
  // had one request and timed like Sunburst when both were measured
  'gpt-image-2.6-sunburst': { gen: [25, 35.5], edit: [32, 87] },
  'gpt-image-2.6-flare': { gen: [25, 35.5], edit: [32, 87] },
  'gpt-image-2.5-sunburst': { gen: [25, 40], edit: [34.5, 64] },
  'gpt-image-2.5-flare': { gen: [22, 38], edit: [32, 60] },
  'gpt-image-2': { gen: [20.5, 35], edit: [30, 58] },
}
export const TYPICAL_DEFAULT = { gen: [25, 40], edit: [34.5, 64] } as const

export const DEFAULT_PREFS: Prefs = {
  mode: 'agent',
  auto: true,
  brain: DEFAULT_BRAIN,
  effort: 'medium',
  image: DEFAULT_IMAGE_MODEL,
  ratio: 'auto',
  count: 1,
  transparent: false,
  brand: true,
}

export const STORAGE_KEYS = {
  prefs: 'bear-draw.prefs',
  brand: 'bear-draw.brand',
  skills: 'bear-draw.skills',
  favorites: 'bear-draw.favs',
  chatW: 'bear-draw.chatW',
  migrated: 'bear-draw.migrated',
  mood: 'bear-draw.mood',
} as const
