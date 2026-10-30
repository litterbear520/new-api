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
import type { TFunction } from 'i18next'

/** Tried in order when the user has not picked a model yet. */
export const PREFERRED_MODELS = [
  'gpt-6.1-sol',
  'gpt-6-sol',
  'claude-sonnet-4-6',
  'gemini-3.8-flash',
  'gpt-6-luna',
]

/** Models that only make pictures; they live on the drawing page. */
export const IMAGE_MODEL =
  /(^|[-_/])(image|dall-e|imagen|flux|midjourney|mj)([-_.]|$)|^gpt-image/i

/**
 * Short notes for models we know, first match wins. Labels are i18n keys.
 * The cheapest model gets its own tag from the prices.
 */
export const MODEL_NOTES: Array<{ match: RegExp; tag?: string; note: string }> =
  [
    { match: /^gpt-6\.1-sol/, tag: 'Smartest', note: 'Code and hard problems' },
    {
      match: /^gpt-6-astra/,
      tag: 'Most capable',
      note: 'The hardest problems; costs the most',
    },
    {
      match: /^claude-opus/,
      tag: 'Writer',
      note: 'Long writing, editing, web pages',
    },
    { match: /^claude-sonnet/, note: 'Writing and code, a good all-rounder' },
    { match: /^gpt-6-sol/, note: 'Strong at code and reasoning' },
    { match: /^gpt-6-luna/, tag: 'Balanced', note: 'Enough for everyday chat' },
    {
      match: /^gemini-3\.8-flash/,
      tag: 'Fast',
      note: 'Quick answers, reads pictures',
    },
    { match: /^gemini-.*flash-lite/, note: 'Simple questions' },
    { match: /^gemini-.*flash/, note: 'Quick answers, reads pictures' },
  ]

export const DRAW_PAGE = '/draw'

export function getExamples(t: TFunction): string[] {
  return [
    t('Make a birthday card web page for my mum, with balloons floating up'),
    t('Write a Python script that renames photos by the date they were taken'),
    t('Write a four-line poem about a little bear going to sea'),
    t('Translate into English: 今晚的星星很亮，我们明天见。'),
  ]
}

export function getGreeting(
  t: TFunction,
  hour = new Date().getHours()
): string {
  if (hour < 5) return t('Up late')
  if (hour < 11) return t('Good morning')
  if (hour < 13) return t('Good noon')
  if (hour < 18) return t('Good afternoon')
  if (hour < 23) return t('Good evening')
  return t('Up late')
}

/** Status next to the bear while it works; the keys are i18n keys. */
export const WORK_STATUS: Record<string, string> = {
  think: 'Thinking',
  scope: 'Searching',
  read: 'Looking at the picture',
  book: 'Reading',
  calc: 'Calculating',
  write: 'Writing',
  code: 'Coding',
  web: 'Building the page',
  translate: 'Translating',
  bell: 'Waiting for you',
  wand: 'Thinking hard',
  phones: 'Deep in thought',
}
