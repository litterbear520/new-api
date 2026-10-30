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
import { redactImages, type ChatRequestBody } from './payload'

/*
 * The request the page just sent, as code for the user's own app. Uses the
 * public /v1 endpoint of this site with an API key instead of the console
 * session, so `group` (decided by the key) and streaming are left out.
 */

export type SnippetLang = 'curl' | 'python' | 'javascript'

export function publicBody(body: ChatRequestBody): Record<string, unknown> {
  const {
    group: _group,
    stream: _stream,
    stream_options: _opts,
    ...rest
  } = redactImages(body)
  return rest
}

/** A JSON value as a Python literal (strings keep JSON's escapes, which Python reads the same). */
function toPython(value: unknown, pad = ''): string {
  if (value === null || value === undefined) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return JSON.stringify(value)
  const inner = `${pad}    `
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return `[\n${value.map((v) => `${inner}${toPython(v, inner)}`).join(',\n')},\n${pad}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
  if (!entries.length) return '{}'
  return `{\n${entries
    .map(([k, v]) => `${inner}${JSON.stringify(k)}: ${toPython(v, inner)}`)
    .join(',\n')},\n${pad}}`
}

export function snippet(
  lang: SnippetLang,
  body: ChatRequestBody,
  origin: string
): string {
  const base = `${origin}/v1`
  const json = JSON.stringify(publicBody(body), null, 2)
  if (lang === 'curl') {
    const quoted = json.replaceAll("'", `'\\''`)
    return [
      `curl ${base}/chat/completions \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -H "Authorization: Bearer $API_KEY" \\`,
      `  -d '${quoted}'`,
    ].join('\n')
  }
  if (lang === 'python') {
    return [
      'from openai import OpenAI',
      '',
      `client = OpenAI(base_url="${base}", api_key="YOUR_API_KEY")`,
      '',
      `resp = client.chat.completions.create(**${toPython(publicBody(body))})`,
      'print(resp.choices[0].message.content)',
    ].join('\n')
  }
  return [
    `const res = await fetch('${base}/chat/completions', {`,
    `  method: 'POST',`,
    `  headers: {`,
    `    'Content-Type': 'application/json',`,
    `    Authorization: 'Bearer ' + process.env.API_KEY,`,
    `  },`,
    `  body: JSON.stringify(${json.replaceAll('\n', '\n  ')}),`,
    `})`,
    `const data = await res.json()`,
    `console.log(data.choices[0].message.content)`,
  ].join('\n')
}
