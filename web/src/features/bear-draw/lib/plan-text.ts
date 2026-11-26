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
 * The words a planned picture will show, read out of its prompt so the user
 * can correct them on the plan card before paying for the picture.
 */

/** The labelled lines of a prompt (lib/agent/prompt.ts); one of them ends the text part. */
const FIELDS =
  'Use case|Asset type|Primary request|Input images?|Scene(?:/backdrop)?|Backdrop|Subject|Style(?:/medium)?|Medium|Composition(?:/framing)?|Framing|Lighting(?:/mood)?|Mood|Color palette|Palette|Constraints|Avoid|用途|类型|需求|主要需求|输入图|场景|背景|主体|风格|构图|光线|氛围|色调|配色|约束|限制|避免'

/**
 * The `Text (verbatim): …` part of a prompt (the labels lib/adlaw.ts reads),
 * up to the next labelled line. `Headline: "…"` under it is still text.
 */
const TEXT_PART = new RegExp(
  String.raw`^[ \t]*(?:Text(?:[ \t]*\(verbatim\))?|In-image text|文字|文案|画面文字)[ \t]*[:：][^\n]*(?:\n(?![ \t]*(?:${FIELDS})[ \t]*[:：])[^\n]*)*`,
  'im'
)

/** A quoted string, with the quotes lib/adlaw.ts reads. */
const QUOTED = /"([^"\n]+)"|“([^”\n]+)”|「([^」\n]+)」|『([^』\n]+)』/g

type Shown = { text: string; from: number; to: number }

/** The quoted strings of the text part, with where each sits in the prompt. */
function shown(prompt: string): Shown[] {
  const part = TEXT_PART.exec(prompt)
  if (!part) return []
  return [...part[0].matchAll(QUOTED)].map((m) => {
    const text = m[1] ?? m[2] ?? m[3] ?? m[4]
    const from = part.index + m.index + 1
    return { text, from, to: from + text.length }
  })
}

/** The quoted strings a picture is asked to show, in order. */
export function planTexts(prompt: string): string[] {
  return shown(prompt).map((x) => x.text)
}

/**
 * The prompt with its nth shown string changed, at its own place only. When
 * no other shown string reads the same, the same string in quotes elsewhere
 * in the prompt (a headline repeated in the request line) changes with it,
 * so the prompt does not ask for two versions. Empty words change nothing.
 */
export function replacePlanText(
  prompt: string,
  index: number,
  next: string
): string {
  const all = shown(prompt)
  const old = all[index]
  // The quotes of the prompt would end early on these.
  const clean = next.replaceAll(/["“”「」『』\n]/g, '').trim()
  if (!old || !clean || clean === old.text) return prompt
  const alone = all.filter((x) => x.text === old.text).length === 1
  const swap = (part: string) =>
    alone
      ? part.replaceAll(QUOTED, (whole, a, b, c, d) =>
          (a ?? b ?? c ?? d) === old.text
            ? whole[0] + clean + whole.at(-1)
            : whole
        )
      : part
  return swap(prompt.slice(0, old.from)) + clean + swap(prompt.slice(old.to))
}

/** What the picture is, for the card: the request line, else the first line. */
export function planSummary(prompt: string): string {
  const request = /^[ \t]*Primary request[:：][ \t]*([^\n]+)/m.exec(prompt)?.[1]
  const line = request ?? prompt.split('\n').find((x) => x.trim()) ?? ''
  return line.trim().slice(0, 200)
}
