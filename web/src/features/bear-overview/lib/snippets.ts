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

import type { SetupTool } from '../constants'

/** A config snippet split so the key can be highlighted or swapped in. */
export interface Snippet {
  /** Where the text goes */
  where: string
  parts: Array<string | { key: true }>
}

const KEY = { key: true } as const

/**
 * Setup snippets for the new-user checklist. They follow the docs pages
 * (/docs/tools/…, /docs/quickstart/) so a copied config matches the guide.
 */
export function buildSnippet(
  tool: SetupTool,
  origin: string,
  t: TFunction
): Snippet {
  switch (tool) {
    case 'Claude Code':
      return {
        where: '~/.claude/settings.json',
        parts: [
          '{\n  "env": {\n',
          `    "ANTHROPIC_BASE_URL": "${origin}",\n`,
          '    "ANTHROPIC_AUTH_TOKEN": "',
          KEY,
          '",\n',
          '    "ANTHROPIC_MODEL": "claude-sonnet-4-6",\n',
          '    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-6",\n',
          '    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-6",\n',
          '    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gpt-6-luna",\n',
          '    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-sonnet-4-6",\n',
          '    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"\n',
          '  }\n}',
        ],
      }
    case 'Codex':
      return {
        where: t('{{path}} (at the top of the file)', {
          path: '~/.codex/config.toml',
        }),
        parts: [
          'model = "gpt-6.1-sol"\nmodel_provider = "xiaoxiong"\n\n',
          '[model_providers.xiaoxiong]\nname = "小熊API"\n',
          `base_url = "${origin}/v1"\n`,
          'env_key = "XIAOXIONG_API_KEY"\nwire_api = "responses"\n\n',
          '# export XIAOXIONG_API_KEY="',
          KEY,
          '"',
        ],
      }
    case 'Cherry Studio':
      return {
        where: t('Settings → Model Provider → New API'),
        parts: [`${t('API address')}: ${origin}\n`, `${t('API key')}: `, KEY],
      }
    case 'curl':
      return {
        where: t('Run in a terminal'),
        parts: [
          `curl ${origin}/v1/chat/completions \\\n`,
          '  -H "Authorization: Bearer ',
          KEY,
          '" \\\n',
          '  -H "Content-Type: application/json" \\\n',
          `  -d '{"model": "gpt-6-luna", "messages": [{"role": "user", "content": "${t('Hello')}"}]}'`,
        ],
      }
  }
}

export function snippetText(snippet: Snippet, key: string): string {
  return snippet.parts
    .map((part) => (typeof part === 'string' ? part : key))
    .join('')
}
