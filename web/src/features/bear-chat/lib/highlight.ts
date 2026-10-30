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
/*
 * A small regex highlighter for the artifact panel. It only has to look
 * right while code streams in line by line, so it trades precision for speed
 * and size: one combined regex per language, HTML handled by a tiny state
 * machine that hands <style> and <script> bodies to the CSS and JS rules.
 * Output is plain tokens, rendered as text (never as HTML).
 */

/** k keyword · s string · c comment · n number · f function/property · t tag · a attribute */
export type TokenClass = '' | 'k' | 's' | 'c' | 'n' | 'f' | 't' | 'a'
export type Token = [TokenClass, string]

type Rule = [TokenClass, string]

const C_COMMENT = String.raw`\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)`
const HASH_COMMENT = String.raw`#[^\n]*`
const DQ = String.raw`"(?:\\.|[^\\"\n])*"?`
const SQ = String.raw`'(?:\\.|[^\\'\n])*'?`
const BQ = String.raw`\x60(?:\\[\s\S]|[^\\\x60])*\x60?`
const NUMBER = String.raw`\b(?:0x[\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b`
const CALL = String.raw`\b[A-Za-z_$][\w$]*(?=\s*\()`

const words = (list: string) =>
  String.raw`\b(?:${list.trim().split(/\s+/).join('|')})\b`

const JS_KW = words(`
  async await break case catch class const continue debugger default delete do
  else export extends false finally for from function if import in instanceof
  let new null of return static super switch this throw true try typeof
  undefined var void while with yield interface type enum implements
  declare readonly as satisfies keyof private protected public`)
const PY_KW = words(`
  and as assert async await break class continue def del elif else except
  False finally for from global if import in is lambda None nonlocal not or
  pass raise return True try while with yield self print`)
const C_KW = words(`
  auto break case char const continue default do double else enum extern
  float for goto if int long register return short signed sizeof static
  struct switch typedef union unsigned void volatile while bool true false
  class public private protected virtual namespace using template typename
  new delete this nullptr func package import var type map chan go defer
  select range fn let mut impl trait pub use mod match loop where crate
  string interface override val fun when object companion suspend`)
const SQL_KW = words(`
  select from where and or not insert into values update set delete create
  table drop alter add index primary key foreign references join left right
  inner outer on group by order having limit offset as distinct union all
  null is in like between case when then else end exists count sum avg min
  max SELECT FROM WHERE AND OR NOT INSERT INTO VALUES UPDATE SET DELETE CREATE
  TABLE DROP ALTER ADD INDEX PRIMARY KEY FOREIGN REFERENCES JOIN LEFT RIGHT
  INNER OUTER ON GROUP BY ORDER HAVING LIMIT OFFSET AS DISTINCT UNION ALL
  NULL IS IN LIKE BETWEEN CASE WHEN THEN ELSE END EXISTS COUNT SUM AVG`)
const SH_KW = words(`
  if then else elif fi for while until do done case esac function in return
  exit export local readonly echo printf cd source sudo set unset shift`)

const RULES: Record<string, Rule[]> = {
  js: [
    ['c', C_COMMENT],
    ['s', `${BQ}|${DQ}|${SQ}`],
    ['n', NUMBER],
    ['k', JS_KW],
    ['f', CALL],
  ],
  py: [
    ['c', HASH_COMMENT],
    [
      's',
      String.raw`[rRbBuUfF]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|${DQ}|${SQ})`,
    ],
    ['f', String.raw`@[\w.]+`],
    ['n', NUMBER],
    ['k', PY_KW],
    ['f', CALL],
  ],
  c: [
    ['c', C_COMMENT],
    ['s', `${BQ}|${DQ}|${SQ}`],
    ['n', NUMBER],
    ['k', C_KW],
    ['f', CALL],
  ],
  css: [
    ['c', String.raw`\/\*[\s\S]*?(?:\*\/|$)`],
    ['s', `${DQ}|${SQ}`],
    ['k', String.raw`@[\w-]+|!important`],
    [
      'n',
      String.raw`#[\da-fA-F]{3,8}\b|-?\b\d*\.?\d+(?:px|em|rem|vh|vw|vmin|vmax|%|s|ms|deg|fr|ch)?\b`,
    ],
    ['f', String.raw`[\w-]+(?=\s*:(?!:))|[\w-]+(?=\()`],
  ],
  json: [
    ['f', String.raw`"(?:\\.|[^\\"\n])*"(?=\s*:)`],
    ['s', DQ],
    ['n', String.raw`-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b`],
    ['k', String.raw`\b(?:true|false|null)\b`],
  ],
  sh: [
    ['c', String.raw`(?:^|\s)#[^\n]*`],
    ['s', `${DQ}|${SQ}`],
    ['f', String.raw`\$\{[^}\n]*\}?|\$[\w@#?*!$-]`],
    ['k', SH_KW],
    ['a', String.raw`\s--?[\w-]+`],
    ['n', NUMBER],
  ],
  sql: [
    ['c', String.raw`--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)`],
    ['s', `${SQ}|${DQ}`],
    ['n', NUMBER],
    ['k', SQL_KW],
    ['f', CALL],
  ],
  yaml: [
    ['c', HASH_COMMENT],
    ['f', String.raw`^[ \t-]*[\w.-]+(?=\s*:)`],
    ['s', `${DQ}|${SQ}`],
    ['k', String.raw`\b(?:true|false|null|yes|no|on|off)\b`],
    ['n', NUMBER],
  ],
  md: [
    ['k', String.raw`^#{1,6} [^\n]*`],
    ['s', String.raw`\x60[^\x60\n]+\x60`],
    ['f', String.raw`\*\*[^*\n]+\*\*`],
    ['a', String.raw`\[[^\]\n]+\]\([^)\n]*\)`],
  ],
  plain: [
    ['c', String.raw`\/\/[^\n]*|#[^\n]*`],
    ['s', `${DQ}|${SQ}`],
    ['n', NUMBER],
  ],
}

const FAMILY: Record<string, keyof typeof RULES> = {
  javascript: 'js',
  typescript: 'js',
  jsx: 'js',
  tsx: 'js',
  json: 'json',
  python: 'py',
  css: 'css',
  scss: 'css',
  less: 'css',
  bash: 'sh',
  powershell: 'sh',
  sql: 'sql',
  yaml: 'yaml',
  toml: 'yaml',
  markdown: 'md',
  c: 'c',
  cpp: 'c',
  csharp: 'c',
  java: 'c',
  go: 'c',
  rust: 'c',
  kotlin: 'c',
  swift: 'c',
  php: 'c',
  dart: 'c',
  ruby: 'py',
  lua: 'plain',
}

const compiled = new Map<string, RegExp>()

function regexFor(family: keyof typeof RULES): RegExp {
  let re = compiled.get(family)
  if (!re) {
    re = new RegExp(RULES[family].map(([, src]) => `(${src})`).join('|'), 'gm')
    compiled.set(family, re)
  }
  re.lastIndex = 0
  return re
}

function push(out: Token[], cls: TokenClass, text: string) {
  if (!text) return
  const last = out.at(-1)
  if (last && last[0] === cls) last[1] += text
  else out.push([cls, text])
}

function tokenizeWith(family: keyof typeof RULES, code: string, out: Token[]) {
  const rules = RULES[family]
  const re = regexFor(family)
  let at = 0
  for (let m = re.exec(code); m; m = re.exec(code)) {
    if (!m[0]) {
      re.lastIndex++
      continue
    }
    push(out, '', code.slice(at, m.index))
    const group = m.findIndex((g, i) => i > 0 && g !== undefined)
    push(out, rules[group - 1]?.[0] ?? '', m[0])
    at = m.index + m[0].length
  }
  push(out, '', code.slice(at))
}

const TAG_START =
  /<!--[\s\S]*?(?:-->|$)|<!doctype[^>]*>?|<\/?[A-Za-z][\w:.-]*/gi
const IN_TAG = /\s+|\/?>|[^\s"'>/=]+|=|"[^"]*"?|'[^']*'?|\//y

function tokenizeHtml(code: string, out: Token[]) {
  let at = 0
  TAG_START.lastIndex = 0
  for (let m = TAG_START.exec(code); m; m = TAG_START.exec(code)) {
    push(out, '', code.slice(at, m.index))
    const tok = m[0]
    if (tok.startsWith('<!')) {
      push(out, 'c', tok)
      at = m.index + tok.length
      continue
    }
    push(out, 't', tok)
    const name = tok.replace(/^<\/?/, '').toLowerCase()
    const closing = tok.startsWith('</')
    let p = m.index + tok.length
    let ended = false
    IN_TAG.lastIndex = p
    for (let a = IN_TAG.exec(code); a; a = IN_TAG.exec(code)) {
      const s = a[0]
      p = IN_TAG.lastIndex
      if (s === '>' || s === '/>') {
        push(out, 't', s)
        ended = true
        break
      }
      if (/^\s/.test(s) || s === '=' || s === '/') push(out, '', s)
      else if (s[0] === '"' || s[0] === "'") push(out, 's', s)
      else push(out, 'a', s)
    }
    at = p
    if (ended && !closing && (name === 'script' || name === 'style')) {
      const end = code.toLowerCase().indexOf(`</${name}`, at)
      const body = code.slice(at, end < 0 ? code.length : end)
      tokenizeWith(name === 'style' ? 'css' : 'js', body, out)
      at += body.length
    }
    TAG_START.lastIndex = at
    if (!ended) break
  }
  push(out, '', code.slice(at))
}

/** Tokens per line, ready to render. */
export function highlight(code: string, lang: string): Token[][] {
  const flat: Token[] = []
  if (lang === 'html' || lang === 'svg' || lang === 'xml' || lang === 'vue') {
    tokenizeHtml(code, flat)
  } else {
    tokenizeWith(FAMILY[lang] ?? 'plain', code, flat)
  }
  const lines: Token[][] = [[]]
  for (const [cls, text] of flat) {
    const parts = text.split('\n')
    parts.forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part) lines.at(-1)?.push([cls, part])
    })
  }
  return lines
}
