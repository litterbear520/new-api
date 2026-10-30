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
import type { LicenseFile } from '../data/credits'

/*
 * Long texts that load on demand, each in its own small chunk: the built-in
 * skills' SKILL.md, their reference notes, and the licence texts.
 *
 * They are stored as .txt on purpose: Rsbuild 2 has a ?raw rule only for
 * known asset types (.txt yes, .md no: the build fails), and oxfmt leaves
 * .txt alone, so the quoted excerpts stay byte-identical to their sources.
 */

type Loader = () => Promise<{ default: string }>

const SKILL_TEXTS: Record<string, Loader> = {
  'taobao-main-set': () =>
    import('../data/skill-texts/taobao-main-set.txt?raw'),
  'white-background': () =>
    import('../data/skill-texts/white-background.txt?raw'),
  'detail-page': () => import('../data/skill-texts/detail-page.txt?raw'),
  'xhs-cover': () => import('../data/skill-texts/xhs-cover.txt?raw'),
  'live-douyin': () => import('../data/skill-texts/live-douyin.txt?raw'),
  'promo-poster': () => import('../data/skill-texts/promo-poster.txt?raw'),
  'ad-creative': () => import('../data/skill-texts/ad-creative.txt?raw'),
  'packaging-system': () =>
    import('../data/skill-texts/packaging-system.txt?raw'),
  'logo-mockup': () => import('../data/skill-texts/logo-mockup.txt?raw'),
  'brand-vi': () => import('../data/skill-texts/brand-vi.txt?raw'),
  'before-after': () => import('../data/skill-texts/before-after.txt?raw'),
  'style-transfer': () => import('../data/skill-texts/style-transfer.txt?raw'),
}

/** Reference notes by skill, keyed by the path the SKILL.md uses. */
const SKILL_REFERENCES: Record<string, Record<string, Loader>> = {
  'ad-creative': {
    'references/static-templates.md': () =>
      import('../data/skill-texts/references/ad-creative/static-templates.txt?raw'),
  },
  'brand-vi': {
    'references/visual-modes.md': () =>
      import('../data/skill-texts/references/brand-vi/visual-modes.txt?raw'),
    'references/theme-presets.md': () =>
      import('../data/skill-texts/references/brand-vi/theme-presets.txt?raw'),
  },
  'logo-mockup': {
    'references/logo-prompts.md': () =>
      import('../data/skill-texts/references/logo-mockup/logo-prompts.txt?raw'),
  },
  'style-transfer': {
    'references/edit-recipes.md': () =>
      import('../data/skill-texts/references/style-transfer/edit-recipes.txt?raw'),
  },
}

const LICENSES: Record<LicenseFile, Loader> = {
  'openai-skills-imagegen-APACHE-2.0.txt': () =>
    import('../data/licenses/openai-skills-imagegen-APACHE-2.0.txt?raw'),
  'openai-cookbook-MIT.txt': () =>
    import('../data/licenses/openai-cookbook-MIT.txt?raw'),
  'anthropics-skills-canvas-design-APACHE-2.0.txt': () =>
    import('../data/licenses/anthropics-skills-canvas-design-APACHE-2.0.txt?raw'),
  'anthropics-skills-theme-factory-APACHE-2.0.txt': () =>
    import('../data/licenses/anthropics-skills-theme-factory-APACHE-2.0.txt?raw'),
  'marketingskills-MIT.txt': () =>
    import('../data/licenses/marketingskills-MIT.txt?raw'),
  'open-design-APACHE-2.0.txt': () =>
    import('../data/licenses/open-design-APACHE-2.0.txt?raw'),
  'brandkit-taste-skill-MIT.txt': () =>
    import('../data/licenses/brandkit-taste-skill-MIT.txt?raw'),
  'ui-ux-pro-max-skill-MIT.txt': () =>
    import('../data/licenses/ui-ux-pro-max-skill-MIT.txt?raw'),
}

async function load(loader: Loader | undefined): Promise<string | null> {
  if (!loader) return null
  try {
    return (await loader()).default
  } catch {
    // The chunk failed to load (offline, new deploy): callers go on without it.
    return null
  }
}

/** A built-in skill's SKILL.md; null for other ids or when it can't load. */
export async function loadSkillText(id: string): Promise<string | null> {
  return load(Object.hasOwn(SKILL_TEXTS, id) ? SKILL_TEXTS[id] : undefined)
}

/**
 * A built-in skill's reference notes (the ones that loaded); `path` is how
 * its SKILL.md names them, e.g. references/visual-modes.md.
 */
export async function loadSkillReferences(
  id: string
): Promise<Array<{ path: string; text: string }>> {
  if (!Object.hasOwn(SKILL_REFERENCES, id)) return []
  const entries = Object.entries(SKILL_REFERENCES[id])
  const texts = await Promise.all(entries.map(([, loader]) => load(loader)))
  return entries.flatMap(([path], i) => {
    const text = texts[i]
    return text ? [{ path, text }] : []
  })
}

/** A licence text from data/licenses (see LICENSE_FILES in data/credits). */
export async function loadLicenseText(
  file: LicenseFile
): Promise<string | null> {
  return load(Object.hasOwn(LICENSES, file) ? LICENSES[file] : undefined)
}

/* ------------------------------------------------------------------ */
/* Frontmatter                                                          */
/* ------------------------------------------------------------------ */

const FRONTMATTER = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/

/** Text with the BOM removed and Windows/old-Mac line ends turned into \n. */
export function normalizeText(text: string): string {
  return text.replace(/^\uFEFF/, '').replaceAll(/\r\n?/g, '\n')
}

function unquote(value: string): string {
  if (/^"[\s\S]*"$/.test(value)) {
    return value
      .slice(1, -1)
      .replaceAll(/\\(["\\])/g, '$1')
      .replaceAll(String.raw`\n`, '\n')
  }
  if (/^'[\s\S]*'$/.test(value)) return value.slice(1, -1).replaceAll("''", "'")
  return value
}

/** A block scalar (| or >) from its indented lines. */
function blockScalar(style: string, lines: string[]): string {
  const indent = Math.min(
    ...lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)?.[0].length ?? 0)
  )
  const body = lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0))
  if (style.startsWith('|')) return body.join('\n').trim()
  // Folded: lines join with spaces, blank lines become line breaks.
  return body
    .join('\n')
    .trim()
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .map((l) => l.trim())
        .join(' ')
    )
    .join('\n')
}

/** Top-level `key: value` pairs of a simple YAML block (no nesting). */
function yamlFields(yaml: string): Record<string, string> {
  const lines = yaml.split('\n')
  const out: Record<string, string> = {}
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-z_][\w-]*)[ \t]*:(?:[ \t]+(.*))?$/.exec(lines[i])
    if (!m) continue
    const more: string[] = []
    while (i + 1 < lines.length && /^(\s|$)/.test(lines[i + 1])) {
      more.push(lines[++i])
    }
    while (more.length && !more.at(-1)?.trim()) more.pop()
    const value = (m[2] ?? '').trim()
    if (/^[|>][+-]?$/.test(value)) {
      out[m[1]] = blockScalar(value, more)
    } else {
      const joined = [value, ...more.map((l) => l.trim())]
        .filter(Boolean)
        .join(' ')
      out[m[1]] = unquote(joined).trim()
    }
  }
  return out
}

/**
 * Splits a SKILL.md into its `---` header fields and the text after it.
 * Without a (closed) header, the whole text is the body.
 */
export function parseFrontmatter(text: string): {
  name?: string
  description?: string
  body: string
} {
  const src = normalizeText(text)
  const m = FRONTMATTER.exec(src)
  if (!m) return { body: src }
  const fields = yamlFields(m[1] ?? '')
  return {
    ...(fields.name ? { name: fields.name } : {}),
    ...(fields.description ? { description: fields.description } : {}),
    body: src.slice(m[0].length).replace(/^\n+/, ''),
  }
}
