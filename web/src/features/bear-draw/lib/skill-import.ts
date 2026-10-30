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
import type { Skill } from '../types'
import { normalizeText, parseFrontmatter } from './skill-text'

/*
 * Turns an imported SKILL.md (the format Claude Code, Codex and Lovart use)
 * into one of the user's own skills. Errors are English sentences that are
 * also i18n keys: show them with t(error.message).
 */

/** Skills live in localStorage, so keep them reasonably small. */
const MAX_CHARS = 200_000
const NAME_MAX = 40
const TAGLINE_MAX = 30
const DESCRIPTION_MAX = 200
/** File names that say nothing about the skill. */
const GENERIC_FILE = /^(skill|readme|index)$/i

function cut(text: string, max: number): string {
  const chars = [...text]
  return chars.length > max ? `${chars.slice(0, max).join('').trim()}…` : text
}

/** Mostly text? A ZIP or a picture read as text has NULs or replacement characters. */
function isText(text: string): boolean {
  if (text.includes('\u0000')) return false
  const bad = text.match(/�/g)?.length ?? 0
  return bad <= Math.max(8, text.length / 100)
}

function firstHeading(body: string): string {
  const m = /^#{1,3}[ \t]+(.+?)[ \t#]*$/m.exec(body)
  return m ? m[1].trim() : ''
}

/** The folder or file name, unless it is just SKILL.md. */
function nameFromFile(fileName?: string): string {
  const parts = (fileName ?? '').split(/[\\/]/).filter(Boolean)
  const base = (parts.pop() ?? '').replace(/\.(md|markdown|txt)$/i, '')
  if (base && !GENERIC_FILE.test(base)) return base
  return parts.pop() ?? ''
}

/** The body's first plain paragraph, for skills without a description. */
function firstParagraph(body: string): string {
  let inFence = false
  for (const block of body.split(/\n\s*\n/)) {
    const lines = block.trim().split('\n')
    const wasInFence = inFence
    const fences = lines.filter((l) => /^\s*(```|~~~)/.test(l)).length
    if (fences % 2) inFence = !inFence
    const line = lines[0] ?? ''
    if (
      wasInFence ||
      fences ||
      !line ||
      /^(#|>|[-*+]\s|\d+\.\s|\||<)/.test(line)
    ) {
      continue
    }
    return cut(lines.join(' ').replaceAll(/\s+/g, ' ').trim(), DESCRIPTION_MAX)
  }
  return ''
}

/** The description's first sentence, shortened for cards. */
function tagline(description: string): string {
  const end = /[。！？!?\n]|\.(\s|$)/.exec(description)
  const first = end ? description.slice(0, end.index) : description
  return cut(first.trim(), TAGLINE_MAX)
}

function slug(name: string): string {
  const s = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/, '')
  return s || 'skill'
}

function randomPart(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('')
}

/**
 * Reads a SKILL.md into a user skill (category 'mine'). The name comes from
 * the --- header, else the first # title, else the file or folder name.
 * Throws for empty, binary, oversized or nameless input.
 */
export function parseSkillMd(text: string, fileName?: string): Skill {
  const src = normalizeText(text)
  if (!src.trim()) throw new Error('Not a SKILL.md: the file is empty')
  if (src.length > MAX_CHARS) {
    throw new Error('Not a SKILL.md: the file is larger than 200 KB')
  }
  if (!isText(src)) throw new Error('Not a SKILL.md: it is not a text file')
  const fm = parseFrontmatter(src)
  if (/^---[ \t]*(\n|$)/.test(src) && fm.body === src) {
    throw new Error('Not a SKILL.md: the --- header at the top is not closed')
  }
  const name = cut(
    fm.name?.trim() || firstHeading(fm.body) || nameFromFile(fileName),
    NAME_MAX
  )
  if (!name) {
    throw new Error(
      'Not a SKILL.md: give it a name (name: in the --- header, or a # title)'
    )
  }
  const description = cut(
    fm.description?.trim() || firstParagraph(fm.body),
    DESCRIPTION_MAX
  )
  return {
    id: `mine-${slug(name)}-${randomPart()}`,
    name,
    tagline: tagline(description),
    description,
    category: 'mine',
    platforms: [],
    author: '',
    starters: [],
    questions: [],
    deliverables: [],
    covers: [],
    sources: [],
    text: src,
    mine: true,
    createdAt: Date.now(),
  }
}
