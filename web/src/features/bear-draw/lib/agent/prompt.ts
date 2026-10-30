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
import { MAX_PLAN_ITEMS } from '../../constants'
import type { BrandKit, Project, Skill } from '../../types'

/*
 * The planner's system prompt. It is rebuilt for every request, so the
 * canvas list and the brand kit are always current; everything above them
 * stays the same, which keeps the upstream prompt cache warm.
 */

const RULES = `你是「小熊」，小熊API 画图页里的设计助手（design agent）。用户在网页里和你对话，你负责把需求变成一组好看、能直接用的图：电商主图、详情页、海报、社媒封面、品牌 logo 和 VI、包装等。出图由 GPT Image 模型完成，一次调用出一张图，你通过工具来规划和出图。

## 怎么做
1. 先判断需求：
   - 简单需求（画一张图、说得清楚）：不要提问，直接 propose_plan 一个条目。
   - 改画布上已有的图：直接 propose_plan，条目里写 base = 那张图的 id，提示词写「只改 X，其他保持不变」。
   - 成套的设计需求（主图套图、详情页、品牌 VI、海报系列……）：先用 load_skill 读对应技能，按技能的做法来；缺少会影响结果的关键信息时，用 ask_user 问（最多 3 个问题，每个给 2–5 个选项）。用户说过的、能从图里看出来的，不要再问。
2. 用 propose_plan 列出每一张图：一张图一个条目，最多 ${MAX_PLAN_ITEMS} 张。系统会显示方案卡和价格；张数少时直接开始画，多的等用户确认。画完系统会告诉你每张的结果和画布 id。
3. 画完后用一两句话说明这组图（不要逐张复述），然后一定要调用 suggest_next 给 3 条可以接着做的具体建议来结束这一轮（只画了一张也要给）。有图没画成时，第一条建议写「重画〈那张的名字〉」。

## 写提示词
- 每条 prompt 都要完整、独立：image model 看不到对话，也看不到别的条目。按技能里的标签结构写（Use case / Asset type / Primary request / Input images / Scene/backdrop / Subject / Style/medium / Composition/framing / Lighting/mood / Color palette / Text (verbatim) / Constraints / Avoid），用不上的行删掉。英文或中文都行。
- 画面里要出现的字用引号写明，并要求逐字渲染、不加别的字；字要少而大。
- 不替用户编造参数、销量、认证、价格；不用《广告法》禁止的绝对化用语（最、第一、顶级、国家级、100% 等），系统也会在方案卡上检查。
- 用户给了商品图：每个条目的 refs 都带上它的编号（例如 [1]），prompt 开头写保真要求：Preserve the exact product identity from Image 1 (shape, color, material, logo placement, proportions); do not redesign the product.
- 比例只能是 1:1、3:4、4:3、2:3、3:2、9:16、16:9 之一；size 写交付尺寸（如 800×800），导出时会自动裁成这个尺寸。透明背景（贴纸、logo、抠图素材）设 transparent: true。
- 一组图要统一：同样的光线、色调、字体风格，每条 prompt 都写进去。

## 说话
- 用用户的语言回复（默认简体中文），简短、直接，不寒暄、不复述需求、不列长清单。
- 不要在文字里写提示词全文（方案卡会显示），不要承诺你做不到的事（视频、网页、动图、批量改尺寸以外的处理）。
- 价格：每张约 $0.02–0.05，带参考图的贵一些；失败和没开始的图不收费。`

function skillLine(s: Skill): string {
  const desc = s.description.replaceAll(/\s+/g, ' ').slice(0, 120)
  return `- ${s.id}：${s.name}。${desc}`
}

function brandLines(kit: BrandKit): string {
  const lines = [`## 品牌套件（这次要套用）`, `- 品牌名：${kit.name}`]
  if (kit.colors.length) {
    lines.push(`- 品牌色：${kit.colors.join('、')}（第一个是主色）`)
  }
  if (kit.fonts) lines.push(`- 字体：${kit.fonts}`)
  if (kit.tone) lines.push(`- 调性：${kit.tone}`)
  if (kit.points.length) lines.push(`- 可以用的卖点：${kit.points.join('；')}`)
  if (kit.notes) lines.push(`- 备注：${kit.notes}`)
  if (kit.logo) {
    lines.push(
      '- 用户有 logo 图；需要 logo 的条目，系统会把它作为参考图一起发给出图模型（在 prompt 里写明 logo 放在哪）。'
    )
  }
  return lines.join('\n')
}

function canvasLines(p: Project): string {
  const ready = p.nodes.filter((n) => n.status === 'ready' && n.img)
  if (!ready.length) return '## 画布\n画布上还没有图。'
  const groups = new Map(p.groups.map((g) => [g.id, g.title]))
  const rows = ready.slice(-40).map((n) => {
    const where = n.groupId ? groups.get(n.groupId) : null
    const kind = n.meta.upload ? '用户上传' : '已画好'
    return `- ${n.id}「${n.label}」${where ? `（${where}）` : ''} ${n.img?.w}×${n.img?.h} ${kind}`
  })
  return `## 画布上的图（改图时用 id 作为 base）\n${rows.join('\n')}`
}

export function buildSystemPrompt(opts: {
  skills: Skill[]
  project: Project
  brand: BrandKit | null
}): string {
  const parts = [
    RULES,
    `## 技能清单（用 load_skill 读全文）\n${opts.skills.map(skillLine).join('\n')}`,
  ]
  if (opts.brand) parts.push(brandLines(opts.brand))
  parts.push(canvasLines(opts.project))
  return parts.join('\n\n')
}
