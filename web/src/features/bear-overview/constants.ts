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

/** Model families in stacking order (bottom first); colours live in CSS. */
export const FAMILY_KEYS = [
  'gpt',
  'claude',
  'gemini',
  'image',
  'other',
] as const
export type FamilyKey = (typeof FAMILY_KEYS)[number]

/** Legend names (i18n keys; GPT, Claude and Gemini are brand names). */
export const FAMILY_LABELS: Record<FamilyKey, string> = {
  gpt: 'GPT',
  claude: 'Claude',
  gemini: 'Gemini',
  image: 'Image',
  other: 'Other',
}

/** Runway under this many days counts as a low balance */
export const LOW_BALANCE_DAYS = 3

export const STORAGE_KEYS = {
  format: 'bear-overview.format',
  line: 'bear-overview.line',
  metric: 'bear-overview.metric',
  range: 'bear-overview.range',
  tool: 'bear-overview.tool',
} as const

export type ApiFormat = 'openai' | 'claude' | 'gemini'

export const API_FORMATS: ReadonlyArray<{
  id: ApiFormat
  label: string
  path: string
  hintKey: string
}> = [
  {
    id: 'openai',
    label: 'OpenAI',
    path: '/v1',
    hintKey:
      'For Codex, Cursor, Cline and the OpenAI SDK. In Cherry Studio, leave out /v1.',
  },
  {
    id: 'claude',
    label: 'Claude',
    path: '',
    hintKey: 'For Claude Code and the Anthropic SDK. They add /v1 themselves.',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    path: '',
    hintKey:
      'For Gemini CLI and the Google GenAI SDK. They add /v1beta themselves.',
  },
]

export const SETUP_TOOLS = [
  'Claude Code',
  'Codex',
  'Cherry Studio',
  'curl',
] as const
export type SetupTool = (typeof SETUP_TOOLS)[number]
