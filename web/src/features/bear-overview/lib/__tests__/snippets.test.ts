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
import { describe, expect, test } from 'vitest'

import { apiBaseUrl } from '../access'
import { buildSnippet, snippetText } from '../snippets'

const t = ((key: string, values?: Record<string, string>) =>
  key.replaceAll(
    /\{\{(\w+)\}\}/g,
    (_, name: string) => values?.[name] ?? ''
  )) as TFunction

describe('buildSnippet', () => {
  test('Claude Code gets the bare domain and the key in AUTH_TOKEN', () => {
    const text = snippetText(
      buildSnippet('Claude Code', 'https://api.example.app', t),
      'sk-real'
    )
    expect(text).toContain('"ANTHROPIC_BASE_URL": "https://api.example.app"')
    expect(text).toContain('"ANTHROPIC_AUTH_TOKEN": "sk-real"')
    expect(() => JSON.parse(text)).not.toThrow()
  })

  test('Codex and curl use the /v1 address', () => {
    const codex = snippetText(buildSnippet('Codex', 'https://a.app', t), 'sk-x')
    const curl = snippetText(buildSnippet('curl', 'https://a.app', t), 'sk-x')
    expect(codex).toContain('base_url = "https://a.app/v1"')
    expect(curl).toContain('curl https://a.app/v1/chat/completions')
    expect(curl).toContain('Bearer sk-x')
  })

  test('each snippet has exactly one place for the key', () => {
    for (const tool of [
      'Claude Code',
      'Codex',
      'Cherry Studio',
      'curl',
    ] as const) {
      const parts = buildSnippet(tool, 'https://a.app', t).parts
      expect(parts.filter((part) => typeof part !== 'string')).toHaveLength(1)
    }
  })
})

describe('apiBaseUrl', () => {
  test('the OpenAI format adds /v1; Claude and Gemini use the bare domain', () => {
    expect(apiBaseUrl('https://a.app/', 'openai')).toBe('https://a.app/v1')
    expect(apiBaseUrl('https://a.app', 'claude')).toBe('https://a.app')
    expect(apiBaseUrl(' https://a.app// ', 'gemini')).toBe('https://a.app')
  })
})
