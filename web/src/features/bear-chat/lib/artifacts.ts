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
import type { Artifact, ArtifactKind, ReplySegment } from '../types'

/*
 * Long or previewable code blocks become "artifacts": a card in the chat and
 * a side panel (preview for HTML/SVG, code otherwise), the way Claude shows
 * them. Only fences at column 0 count, so code inside list items stays in the
 * text. The split is recomputed on every streamed chunk and stays stable:
 * the n-th artifact of a reply always gets the id `${replyId}:${n}`.
 */

/** Code blocks at least this long move to the panel. */
export const CODE_ARTIFACT_LINES = 20
/** Finished HTML this short stays inline unless it has something to look at. */
export const HTML_INLINE_LINES = 3

const FENCE_OPEN = /^(`{3,}|~{3,})[ \t]*([^\s`]*)[^`]*$/
/** Tags that make even a one-line snippet worth previewing. */
const VIEWABLE =
  /<(?:!doctype|html|head|body|style|script|canvas|svg|button|div|section|main|form|table|input|img|video|audio)[\s>/]/i
const SVG_START = /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i

const LANG_ALIASES: Record<string, string> = {
  htm: 'html',
  xhtml: 'html',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  py: 'python',
  python3: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  yml: 'yaml',
  md: 'markdown',
  'c++': 'cpp',
  cs: 'csharp',
  'c#': 'csharp',
  golang: 'go',
  rs: 'rust',
  kt: 'kotlin',
  rb: 'ruby',
  ps1: 'powershell',
  text: '',
  txt: '',
  plaintext: '',
  plain: '',
}

const EXTENSIONS: Record<string, string> = {
  html: 'html',
  svg: 'svg',
  xml: 'xml',
  javascript: 'js',
  typescript: 'ts',
  jsx: 'jsx',
  tsx: 'tsx',
  python: 'py',
  bash: 'sh',
  css: 'css',
  scss: 'scss',
  json: 'json',
  yaml: 'yaml',
  toml: 'toml',
  markdown: 'md',
  sql: 'sql',
  go: 'go',
  rust: 'rs',
  java: 'java',
  kotlin: 'kt',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  csharp: 'cs',
  php: 'php',
  ruby: 'rb',
  powershell: 'ps1',
  vue: 'vue',
  lua: 'lua',
  dart: 'dart',
  r: 'r',
}

const FILE_HINT =
  /([\w一-龥][\w一-龥.-]*\.(?:html?|svg|py|js|mjs|ts|tsx|jsx|css|scss|json|ya?ml|toml|md|sh|sql|go|rs|java|kt|swift|c|cpp|cs|php|rb|vue|lua|dart))(?![\w.])/i

export function normalizeLang(raw: string): string {
  const lang = raw.trim().toLowerCase()
  return LANG_ALIASES[lang] ?? lang
}

export function extensionFor(lang: string): string {
  return EXTENSIONS[lang] ?? 'txt'
}

function classify(
  lang: string,
  code: string,
  lines: number,
  closed: boolean
): ArtifactKind | null {
  const svgLike = !lang || lang === 'xml' || lang === 'html'
  if (lang === 'svg' || (svgLike && SVG_START.test(code))) return 'svg'
  if (lang === 'html') {
    // while it streams it goes to the panel at once (no inline flash); once
    // finished, only a tiny snippet with nothing to look at stays inline
    if (!closed || lines >= HTML_INLINE_LINES || VIEWABLE.test(code)) {
      return 'html'
    }
    return null
  }
  // an unlabelled block that is clearly a whole page
  if (!lang) {
    return /^\s*(?:<!doctype html|<html[\s>])/i.test(code) ? 'html' : null
  }
  return lines >= CODE_ARTIFACT_LINES ? 'code' : null
}

function htmlTitle(code: string): string {
  const m =
    /<title[^>]*>([^<]{1,80})<\/title>/i.exec(code) ??
    /<h1[^>]*>([^<]{1,80})<\/h1>/i.exec(code)
  return m ? m[1].replaceAll(/\s+/g, ' ').trim() : ''
}

/** A file name mentioned on the last line before the code, e.g. `rename.py`. */
function fileHint(before: string[]): string {
  for (let i = before.length - 1; i >= 0 && i >= before.length - 3; i--) {
    const line = before[i].trim()
    if (!line) continue
    const m = FILE_HINT.exec(line)
    return m ? m[1] : ''
  }
  return ''
}

function safeFileName(name: string): string {
  return name
    .replaceAll(/[\\/:*?"<>|]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

function makeArtifact(
  replyId: string,
  n: number,
  kind: ArtifactKind,
  lang: string,
  code: string,
  closed: boolean,
  hint: string
): Artifact {
  if (kind !== 'code') lang = kind
  const ext = extensionFor(lang)
  let title = hint
  if (!title && kind === 'html') title = htmlTitle(code)
  let file = hint
  if (!file) {
    const base = kind === 'html' ? safeFileName(title) || 'index' : 'code'
    file = `${base}.${ext}`
  }
  return {
    id: `${replyId}:${n}`,
    replyId,
    kind,
    lang,
    code,
    closed,
    title,
    file,
  }
}

function isClose(line: string, fence: string): boolean {
  const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)
  return !!m && m[1][0] === fence[0] && m[1].length >= fence.length
}

export type OpenBlock = { lang: string; kind: ArtifactKind | 'inline' }

export type SplitReply = {
  segments: ReplySegment[]
  artifacts: Artifact[]
  /** The code block still being written, if the reply ends inside one. */
  open: OpenBlock | null
}

/** The last split per reply; a streaming reply is split by several readers per chunk. */
const recent = new Map<string, { content: string; result: SplitReply }>()
const RECENT_MAX = 64

export function splitReply(content: string, replyId: string): SplitReply {
  const hit = recent.get(replyId)
  if (hit && hit.content === content) return hit.result
  const result = split(content, replyId)
  recent.delete(replyId)
  recent.set(replyId, { content, result })
  if (recent.size > RECENT_MAX) {
    recent.delete(recent.keys().next().value as string)
  }
  return result
}

function split(content: string, replyId: string): SplitReply {
  const lines = content.split('\n')
  const segments: ReplySegment[] = []
  const artifacts: Artifact[] = []
  let buf: string[] = []
  let open: OpenBlock | null = null

  const flush = () => {
    const text = buf.join('\n')
    buf = []
    if (text.trim()) {
      segments.push({ type: 'text', text, key: `t${segments.length}` })
    }
  }

  let i = 0
  while (i < lines.length) {
    const m = FENCE_OPEN.exec(lines[i])
    if (!m) {
      buf.push(lines[i])
      i++
      continue
    }
    const fence = m[1]
    const lang = normalizeLang(m[2] ?? '')
    let j = i + 1
    while (j < lines.length && !isClose(lines[j], fence)) j++
    const closed = j < lines.length
    const body = lines.slice(i + 1, j)
    const code = body.join('\n')
    const kind = classify(lang, code, body.length, closed)
    if (kind) {
      const hint = fileHint(buf)
      flush()
      const artifact = makeArtifact(
        replyId,
        artifacts.length,
        kind,
        lang,
        code,
        closed,
        hint
      )
      artifacts.push(artifact)
      segments.push({ type: 'artifact', artifact, key: artifact.id })
    } else {
      buf.push(...lines.slice(i, closed ? j + 1 : lines.length))
    }
    if (!closed) {
      open = { lang, kind: kind ?? 'inline' }
      break
    }
    i = j + 1
  }
  flush()
  return { segments, artifacts, open }
}

/**
 * Some models write their thinking inline as <think>…</think>. Returns the
 * thinking and the answer separately; `thinking` is true while the closing
 * tag has not arrived.
 */
export function splitThink(content: string): {
  think: string
  text: string
  thinking: boolean
} {
  const lead = content.match(/^\s*<think>/)
  if (!lead) return { think: '', text: content, thinking: false }
  const rest = content.slice(lead[0].length)
  const end = rest.indexOf('</think>')
  if (end < 0) return { think: rest, text: '', thinking: true }
  return {
    think: rest.slice(0, end),
    text: rest.slice(end + 8).replace(/^\s+/, ''),
    thinking: false,
  }
}
