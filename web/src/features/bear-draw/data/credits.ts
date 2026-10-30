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
 * Where the built-in skills and the 「玩法」 prompts come from (the
 * prototype's CREDITS.md, downloaded and counted on 2026-10-25). Texts are
 * data in Chinese, like the skills themselves. Licence texts load with
 * loadLicenseText() in lib/skill-text.ts.
 */

/** Licence texts in data/licenses/. */
export const LICENSE_FILES = [
  'openai-skills-imagegen-APACHE-2.0.txt',
  'openai-cookbook-MIT.txt',
  'anthropics-skills-canvas-design-APACHE-2.0.txt',
  'anthropics-skills-theme-factory-APACHE-2.0.txt',
  'marketingskills-MIT.txt',
  'open-design-APACHE-2.0.txt',
  'brandkit-taste-skill-MIT.txt',
  'ui-ux-pro-max-skill-MIT.txt',
] as const

export type LicenseFile = (typeof LICENSE_FILES)[number]

/** A project the skill texts quote. */
export type SkillCredit = {
  repo: string
  url: string
  /** GitHub stars on 2026-10-25. */
  stars: number
  license: string
  /** Copyright and the commit the excerpts come from. */
  copyright: string
  files: string[]
  /** What we took. */
  used: string
  /** What we changed. */
  changed: string
  licenseFiles: LicenseFile[]
  /** Taken from a copy inside another repo. */
  via?: { repo: string; url: string }
}

/** A prompt collection the 「玩法」 gallery quotes. */
export type GalleryCredit = {
  repo: string
  url: string
  license: string
  /** Prompts taken. */
  count: number
  /** The collection's own showcase page. */
  showcase?: string
  note?: string
}

/** Apache-2.0 §4(b) notice and how the excerpts are marked. */
export const SKILL_CREDITS_NOTE =
  '内置技能的正文摘录了下面这些开源项目的原文：摘录段落一字未改，上方写明「来源 / Source: 仓库 · 文件 › 小节 · 许可证 (verbatim)」；我们的改动写在每个 SKILL.md 的「本站调整」一节，「适用」「工作流程」和示例提示词是我们自己写的。按 Apache-2.0 第 4(b) 条说明：这些文件包含 Apache-2.0 项目的摘录，并由小熊API修改和重新编排。单独导出某个技能时，要把它用到的许可证文件一起带上。'

export const SKILL_CREDITS: SkillCredit[] = [
  {
    repo: 'openai/skills',
    url: 'https://github.com/openai/skills/tree/main/skills/.system/imagegen',
    stars: 28289,
    license: 'Apache-2.0',
    copyright: 'Apache-2.0（Skill 目录内 LICENSE.txt），commit 49f948f',
    files: [
      'skills/.system/imagegen/SKILL.md',
      'references/prompting.md',
      'references/sample-prompts.md',
    ],
    used: '用途分类（16 个 slug）、带标签的提示词结构、提示词增强规则、「一张图调用一次」、编辑时「只改 X、Y 不变」、图内文字逐字、生成和编辑样例',
    changed:
      '不用 Codex 内置工具、CLI 和保存路径相关段落；原文的「no logos」改成允许用户自己的品牌；模型改成本站的三个 gpt-image 模型',
    licenseFiles: ['openai-skills-imagegen-APACHE-2.0.txt'],
  },
  {
    repo: 'openai/openai-cookbook',
    url: 'https://github.com/openai/openai-cookbook/blob/main/examples/multimodal/image-gen-models-prompting-guide.ipynb',
    stars: 76798,
    license: 'MIT',
    copyright: 'MIT © 2025 OpenAI，notebook commit d310dfa',
    files: ['examples/multimodal/image-gen-models-prompting-guide.ipynb'],
    used: '透明背景、gpt-image-2 尺寸规则、Prompting Fundamentals，以及 Logo、广告、教育图、版面说明、风格迁移、虚拟试穿、商品抠图、带字营销图、光线天气、精确替换、节日卡、收藏品包装、角色一致性等小节的说明和提示词',
    changed:
      '只摘说明文字和提示词，不用代码；本站接口不保证按 size 出图，比例改写进提示词；n=4 改成一张图一次调用',
    licenseFiles: ['openai-cookbook-MIT.txt'],
  },
  {
    repo: 'anthropics/skills',
    url: 'https://github.com/anthropics/skills',
    stars: 183542,
    license: 'Apache-2.0',
    copyright:
      'Apache-2.0（canvas-design、theme-factory 目录内各自的 LICENSE.txt），commit dbd4588',
    files: [
      'skills/canvas-design/SKILL.md',
      'skills/theme-factory/SKILL.md',
      'skills/theme-factory/themes/（5 套主题）',
    ],
    used: '设计哲学两步法、文字作为视觉元素、「不加东西，只打磨」；5 套主题的配色和字体',
    changed:
      '方向说明从 4–6 段缩成一句方向名 + 3–4 行；主题只取配色和字体气质，中文字体另选可商用字体；没有摘录点名真实艺术家的两个示例',
    licenseFiles: [
      'anthropics-skills-canvas-design-APACHE-2.0.txt',
      'anthropics-skills-theme-factory-APACHE-2.0.txt',
    ],
  },
  {
    repo: 'coreyhaines31/marketingskills',
    url: 'https://github.com/coreyhaines31/marketingskills',
    stars: 56391,
    license: 'MIT',
    copyright: 'MIT © 2025 Corey Haines，commit e85f3cb',
    files: [
      'skills/image/SKILL.md',
      'skills/image/references/ai-image-prompting.md',
      'skills/ad-creative/SKILL.md',
      'skills/ad-creative/references/{static-ad-templates,generative-tools,short-form-video-specs}.md',
      'skills/social/SKILL.md',
      'skills/social/references/carousel-frameworks.md',
    ],
    used: '角度 → 变体 → 规格校验、标题写法、AI 腔清单、不编造规则、9 个静态广告模板、竖屏安全区、hook 公式、carousel 通用规则和 Value-Stack、AI 做品牌素材的边界、常见提示词错误',
    changed:
      '删掉推广内容（Magister 等）和工具接入段落；海外平台的字符限制改成国内字数建议；平台换成国内；不点名竞品',
    licenseFiles: ['marketingskills-MIT.txt'],
  },
  {
    repo: 'nexu-io/open-design',
    url: 'https://github.com/nexu-io/open-design/tree/main/skills/ecommerce-image-workflow',
    stars: 103786,
    license: 'Apache-2.0',
    copyright: 'Apache-2.0 © 2026 Open Design contributors，commit 9724c44',
    files: [
      'skills/ecommerce-image-workflow/SKILL.md',
      'skills/ecommerce-image-workflow/references/checklist.md',
    ],
    used: '商品身份锚点、保真指令、主图/卖点图/场景图的写法、「不编造声明」检查项、P1 检查',
    changed:
      '3 张扩成 5 张、比例统一 1:1；允许没有参考图时出概念图（必须标注）；不用 od media 命令；加了套图风格锁',
    licenseFiles: ['open-design-APACHE-2.0.txt'],
  },
  {
    repo: 'Leonxlnx/taste-skill',
    url: 'https://github.com/Leonxlnx/taste-skill',
    stars: 102071,
    license: 'MIT',
    copyright: 'MIT © 2026 Leonxlnx（副本目录自带 LICENSE）',
    files: ['skills/brandkit/SKILL.md'],
    used: '核心原则、品牌策略先行、Logo 标准和 5 种构思法、3×3 面板、4 种视觉模式、颜色和文字规则、反套路规则、样机方向、参考图用法、提示词模板',
    changed:
      '默认比例 4:3 改成 3:2；应用物料从数字产品改成国内消费品牌常见物料；Brand Kit 保存是我们加的',
    licenseFiles: ['brandkit-taste-skill-MIT.txt'],
    via: {
      repo: 'nexu-io/open-design',
      url: 'https://github.com/nexu-io/open-design/tree/main/skills/brandkit',
    },
  },
  {
    repo: 'nextlevelbuilder/ui-ux-pro-max-skill',
    url: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills/design',
    stars: 139979,
    license: 'MIT',
    copyright:
      'MIT © 2024 Next Level Builder（design 技能元数据里作者写作 claudekit），commit d14efff',
    files: [
      '.claude/skills/design/references/{banner-sizes-and-styles,cip-prompt-engineering,cip-deliverable-guide,logo-prompt-engineering}.md',
    ],
    used: '22 种视觉风格、版式原则（三段式、安全区、CTA、字号）、样机提示词结构和修饰词、Logo 风格关键词、技术要求和常见坑',
    changed:
      '不用它的脚本和第三方生成服务；「8k」这类质量词注明可以省略；名片尺寸补充国内常用 90×54mm',
    licenseFiles: ['ui-ux-pro-max-skill-MIT.txt'],
  },
]

/** The 「玩法」 prompts and sample pictures; rights stay with the original authors. */
export const GALLERY_CREDITS_NOTE =
  '首页「玩法」里的提示词逐字收录自下列开源合集，示例图也来自这些仓库（多为社区作者用 Nano Banana / GPT Image 生成）。每条都在详情里写了原作者和原帖链接；各仓库都声明提示词和图片的权利归原作者，原作者要求下架时我们会撤下。'

export const GALLERY_CREDITS: GalleryCredit[] = [
  {
    repo: 'renoise-ai/awesome-gpt-image-2-5-prompts',
    url: 'https://github.com/renoise-ai/awesome-gpt-image-2-5-prompts',
    license: 'CC BY 4.0',
    count: 46,
    showcase: 'https://renoise.ai/zh-CN/showcase/awesome-gpt-image-2-5-prompts',
    note: '示例图为 GPT Image 2.5 原图',
  },
  {
    repo: 'freestylefly/awesome-gpt-image-2',
    url: 'https://github.com/freestylefly/awesome-gpt-image-2',
    license: 'MIT',
    count: 13,
  },
  {
    repo: 'Evolink-AI/awesome-gpt-image-2-API-Prompts',
    url: 'https://github.com/Evolink-AI/awesome-gpt-image-2-API-Prompts',
    license: 'CC0',
    count: 6,
  },
  {
    repo: 'jamez-bondos/awesome-gpt4o-images',
    url: 'https://github.com/jamez-bondos/awesome-gpt4o-images',
    license: 'CC BY 4.0',
    count: 5,
  },
  {
    repo: 'PicoTrex/Awesome-Nano-Banana-images',
    url: 'https://github.com/PicoTrex/Awesome-Nano-Banana-images',
    license: 'Apache-2.0',
    count: 4,
  },
  {
    repo: 'ZeroLu/awesome-nanobanana-pro',
    url: 'https://github.com/ZeroLu/awesome-nanobanana-pro',
    license: 'MIT',
    count: 2,
  },
  {
    repo: 'YouMind-OpenLab/awesome-gpt-image-2',
    url: 'https://github.com/YouMind-OpenLab/awesome-gpt-image-2',
    license: 'CC BY 4.0',
    count: 1,
  },
  {
    repo: 'YouMind-OpenLab/awesome-nano-banana-pro-prompts',
    url: 'https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts',
    license: 'CC BY 4.0',
    count: 1,
  },
]
