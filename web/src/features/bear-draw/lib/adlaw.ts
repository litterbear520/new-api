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
import { AD_LAW_BASIS, AD_LAW_GROUPS, type AdLawGroup } from '../data/ad-law'

/*
 * Advertising-law check of the copy a picture will carry, run on each plan
 * item's prompt before drawing.
 *
 * - The copy is the quoted text ("…", “…”, 「…」, 『…』): prompts are mostly
 *   instructions (完全保持商品外观, 第一张…) that never reach the picture.
 *   A text without quotes is checked whole.
 * - Only "ban" and "category" words are flagged. "evidence" words (原价, 限时,
 *   销量, 检测…) are legal with proof and have no safe automatic swap.
 * - Every hit has a concrete replacement ('' = delete) so 「全部替换」 works.
 */

/** A risky word in the copy: `fix` replaces it ('' deletes it). */
export type AdLawMatch = { word: string; fix: string; reason?: string }

type Rule = {
  w: string
  fix: string
  reason: string
  /** Longer words containing `w` that are fine. */
  except: string[]
  /** Any 最… word: only the 最 is replaced. */
  prefix: boolean
}

/** Replacements where the list's first suggestion reads badly in copy. */
const FIX: Record<string, string> = {
  最高: '至高',
  最低: '低至',
  完全: '',
  绝对: '',
  极致: '',
  彻底: '有效',
  终极: '升级',
  美白: '提亮',
  祛斑: '提亮',
  'No.1': '',
  'NO.1': '',
  TOP1: '',
}

/** Common longer forms with a better swap than their parts. */
const EXTRA: Array<{ w: string; fix: string; group: string }> = [
  { w: '全网最低价', fix: '到手价', group: 'price' },
  { w: '史上最低价', fix: '活动价', group: 'price' },
  { w: '销量第一', fix: '人气热销', group: 'first-only' },
]

/** 第一 as an ordinal (第一次, 第一张, 冬天的第一杯…) is not a ranking. */
const ORDINAL_AFTER_FIRST =
  '次步天眼张口件杯单位个排层页章季期批代轮集篇节课周年月日届部款只条号道份场支束封幕波弹站关阶印时视感反手线百千万十秒分小声句段行列题局回遍下圈晚夜首套组'

const EXCEPT: Record<string, string[]> = {
  最: ['最早', '最晚', '最多', '最少'],
  第一: [...[...ORDINAL_AFTER_FIRST].map((c) => `第一${c}`), '第一人称'],
  保证: ['保证金'],
}

/** A suggestion's first alternative, or '' when it only says what to do. */
function deriveFix(suggest: string): string {
  if (suggest.startsWith('删掉')) return ''
  const first = suggest
    .split(/\s*[/；（(]\s*/)[0]
    .replace(/\s*¥X$/, '')
    .trim()
  return /^(写|只有|有依据|真实|要|必须|改成|食品|医疗)|X/.test(first)
    ? ''
    : first
}

function reasonOf(group: AdLawGroup): string {
  const laws = group.basis
    .map((id) => AD_LAW_BASIS.find((b) => b.id === id)?.name)
    .filter(Boolean)
  return [group.name, laws.join('、')].filter(Boolean).join(' · ')
}

function buildRules(): Rule[] {
  const rules: Rule[] = []
  for (const g of AD_LAW_GROUPS) {
    for (const word of g.words) {
      if (word.level === 'evidence') continue
      const prefix = word.match === 'prefix'
      rules.push({
        w: word.w,
        fix: prefix ? '' : (FIX[word.w] ?? deriveFix(word.suggest)),
        reason: reasonOf(g),
        except: [...(word.except ?? []), ...(EXCEPT[word.w] ?? [])],
        prefix,
      })
    }
  }
  for (const x of EXTRA) {
    const g = AD_LAW_GROUPS.find((it) => it.id === x.group)
    rules.push({
      w: x.w,
      fix: x.fix,
      reason: g ? reasonOf(g) : '',
      except: [],
      prefix: false,
    })
  }
  return rules
}

const RULES = buildRules()
const isAscii = (w: string) => /^[\x20-\x7e]+$/.test(w)

/** CJK rules by first character, longest first. */
const BY_FIRST = new Map<string, Rule[]>()
for (const r of RULES.filter((x) => !isAscii(x.w))) {
  BY_FIRST.set(r.w[0], [...(BY_FIRST.get(r.w[0]) ?? []), r])
}
for (const list of BY_FIRST.values()) {
  list.sort(
    (a, b) => Number(a.prefix) - Number(b.prefix) || b.w.length - a.w.length
  )
}

/** No.1 / NO.1 / TOP1 in any case, with an optional dot or space: no. 1, Top 1. */
const ASCII_RULES = RULES.filter((x) => isAscii(x.w)).map((r) => {
  const m = /^([A-Za-z]+)\.?(\d+)$/.exec(r.w)
  const body = m ? `${m[1]}\\.?\\s?${m[2]}(?!\\d)` : escapeRe(r.w)
  return { rule: r, re: new RegExp(body, 'gi') }
})

function escapeRe(s: string): string {
  return s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
}

type Hit = { start: number; end: number; word: string; rule: Rule }

/** Ranges of the copy: the quoted parts, or the whole text without quotes. */
function copyRanges(text: string): Array<[number, number]> {
  const re = /"([^"\s](?:[^"\n]*[^"\s])?)"|“([^”]+)”|「([^」]+)」|『([^』]+)』/g
  const out: Array<[number, number]> = []
  for (const m of text.matchAll(re)) {
    const start = (m.index ?? 0) + 1
    out.push([start, start + m[0].length - 2])
  }
  return out.length ? out : [[0, text.length]]
}

function excepted(rule: Rule, text: string, at: number): boolean {
  return rule.except.some((e) => {
    const k = e.indexOf(rule.w)
    return k >= 0 && at - k >= 0 && text.startsWith(e, at - k)
  })
}

function scanCjk(text: string, from: number, to: number, hits: Hit[]) {
  let i = from
  while (i < to) {
    const rule = BY_FIRST.get(text[i])?.find(
      (r) =>
        (r.prefix || (i + r.w.length <= to && text.startsWith(r.w, i))) &&
        !excepted(r, text, i)
    )
    if (!rule) {
      i += 1
      continue
    }
    const end = rule.prefix ? i + 1 : i + rule.w.length
    hits.push({ start: i, end, word: rule.w, rule })
    i = end
  }
}

function scanAscii(text: string, from: number, to: number, hits: Hit[]) {
  const part = text.slice(from, to)
  for (const { rule, re } of ASCII_RULES) {
    for (const m of part.matchAll(re)) {
      const start = from + (m.index ?? 0)
      if (/[A-Za-z]/.test(text[start - 1] ?? '')) continue
      hits.push({ start, end: start + m[0].length, word: m[0], rule })
    }
  }
}

/** Every flagged word in the copy, in text order, without overlaps. */
function scan(text: string): Hit[] {
  const hits: Hit[] = []
  for (const [from, to] of copyRanges(text)) {
    scanCjk(text, from, to, hits)
    scanAscii(text, from, to, hits)
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end)
  const out: Hit[] = []
  for (const h of hits) {
    const last = out.at(-1)
    if (!last || h.start >= last.end) out.push(h)
  }
  return out
}

/** The risky words in a prompt's copy, each once, in text order. */
export function findAdLaw(text: string): AdLawMatch[] {
  const found = new Map<string, AdLawMatch>()
  for (const h of scan(text)) {
    if (!found.has(h.word)) {
      found.set(h.word, {
        word: h.word,
        fix: h.rule.fix,
        reason: h.rule.reason,
      })
    }
  }
  return [...found.values()]
}

/**
 * Replaces the given words where findAdLaw finds them (so 最近, 第一次 and
 * text outside the quotes stay as they are).
 */
export function applyAdLawFixes(text: string, matches: AdLawMatch[]): string {
  if (!matches.length) return text
  const fixes = new Map(matches.map((m) => [m.word, m.fix]))
  let out = ''
  let last = 0
  for (const h of scan(text)) {
    const fix = fixes.get(h.word)
    if (fix === undefined) continue
    out += text.slice(last, h.start) + fix
    last = h.end
    // A deleted word leaves no double space: "No.1 Choice" → "Choice".
    if (!fix && text[last] === ' ' && /^$|[\s"“「『]$/.test(out.slice(-1))) {
      last += 1
    }
  }
  return out + text.slice(last)
}

/**
 * The words that end up in the picture: quoted parts and "Text (verbatim):"
 * lines. A prompt's other words (moods, styles like 治愈系) are instructions
 * for the image model, not copy, so they are never flagged.
 */
export function promptCopy(prompt: string): string {
  const parts: string[] = []
  const quoted =
    /"([^"\s](?:[^"\n]*[^"\s])?)"|“([^”]+)”|「([^」]+)」|『([^』]+)』/g
  for (const m of prompt.matchAll(quoted)) parts.push(m[0])
  const lines =
    /^\s*(?:Text(?:\s*\(verbatim\))?|In-image text|文字|文案|画面文字)\s*[:：]\s*(.+)$/gim
  for (const m of prompt.matchAll(lines)) {
    const value = m[1].trim()
    if (value && !/^(none|no text|无|没有|不加字)/i.test(value)) {
      parts.push(`“${value.replaceAll(/[“”"]/g, '')}”`)
    }
  }
  return parts.join('\n')
}

/** Risky words in the copy of an image prompt (nothing when it has no copy). */
export function findPromptAdLaw(prompt: string): AdLawMatch[] {
  const copy = promptCopy(prompt)
  return copy ? findAdLaw(copy) : []
}
