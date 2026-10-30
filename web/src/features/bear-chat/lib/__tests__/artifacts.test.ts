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
import { describe, expect, test } from 'vitest'

import { CODE_ARTIFACT_LINES, splitReply, splitThink } from '../artifacts'

const lines = (n: number) =>
  Array.from({ length: n }, (_, i) => `print(${i})`).join('\n')
const page = '<!doctype html>\n<html><body><h1>Hi</h1></body></html>'

describe('splitReply', () => {
  test('a whole HTML page between text becomes an artifact with its title', () => {
    const md = `Here it is:\n\n\`\`\`html\n<!doctype html>\n<title>生日快乐</title>\n<p>ok</p>\n\`\`\`\n\nEnjoy.`
    const { segments, artifacts, open } = splitReply(md, 'r1')
    expect(segments.map((s) => s.type)).toEqual(['text', 'artifact', 'text'])
    expect(artifacts[0]).toMatchObject({
      id: 'r1:0',
      kind: 'html',
      closed: true,
      title: '生日快乐',
      file: '生日快乐.html',
    })
    expect(open).toBeNull()
  })

  test('a one-line page with a button is still previewable', () => {
    const md =
      '```html\n<button onclick="document.body.style.background=\'red\'">Go</button>\n```'
    expect(splitReply(md, 'r9').artifacts[0]).toMatchObject({ kind: 'html' })
  })

  test('a short HTML snippet stays inline once it is finished', () => {
    expect(splitReply('```html\n<b>hi</b>\n```', 'r7').artifacts).toHaveLength(
      0
    )
  })

  test('HTML that is still streaming goes to the panel straight away', () => {
    expect(splitReply('```html\n', 'r8').open).toEqual({
      lang: 'html',
      kind: 'html',
    })
  })

  test('a short snippet stays in the text', () => {
    const md = 'Use:\n\n```python\nprint(1)\n```'
    const { segments, artifacts } = splitReply(md, 'r2')
    expect(artifacts).toHaveLength(0)
    expect(segments).toHaveLength(1)
  })

  test('long code moves to the panel and takes the file name mentioned above it', () => {
    const md = `Save this as \`rename.py\`:\n\n\`\`\`py\n${lines(CODE_ARTIFACT_LINES)}\n\`\`\``
    const { artifacts } = splitReply(md, 'r3')
    expect(artifacts[0]).toMatchObject({
      kind: 'code',
      lang: 'python',
      file: 'rename.py',
    })
  })

  test('an unfinished fence is reported as still being written', () => {
    const { artifacts, open } = splitReply(`\`\`\`html\n${page}`, 'r4')
    expect(open).toEqual({ lang: 'html', kind: 'html' })
    expect(artifacts[0].closed).toBe(false)
  })

  test('code inside a list item is left to the markdown renderer', () => {
    const md = `1. Step\n   \`\`\`python\n${lines(30)}\n   \`\`\``
    expect(splitReply(md, 'r5').artifacts).toHaveLength(0)
  })

  test('an svg block becomes a previewable svg artifact', () => {
    const md = '```xml\n<svg viewBox="0 0 10 10"><circle r="4"/></svg>\n```'
    expect(splitReply(md, 'r6').artifacts[0]).toMatchObject({
      kind: 'svg',
      file: 'code.svg',
    })
  })
})

describe('splitThink', () => {
  test('separates inline thinking from the answer', () => {
    expect(splitThink('<think>hmm</think>\n\nAnswer')).toEqual({
      think: 'hmm',
      text: 'Answer',
      thinking: false,
    })
  })

  test('reports thinking while the closing tag has not arrived', () => {
    expect(splitThink('<think>still')).toEqual({
      think: 'still',
      text: '',
      thinking: true,
    })
  })
})
