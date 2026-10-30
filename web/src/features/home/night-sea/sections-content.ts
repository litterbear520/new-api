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
 * Words and small helpers for the sections under the home page's first
 * screen. The home page is Chinese only, like the copy above them. Tool
 * settings follow the docs pages under /docs/tools/.
 */
import type { Offer } from '@/features/activity/lib/offers'
import { formatSharePercent, isDiscounted } from '@/lib/discount'

export type Line = {
  /** 主线路, 备用线路 1, … from the api_info setting */
  name: string
  /** Site address without a trailing slash */
  url: string
  note?: string
}

/** The lines from the api_info setting, or this site when there are none */
export function readLines(apiInfo: unknown, origin: string): Line[] {
  const lines = Array.isArray(apiInfo)
    ? apiInfo.flatMap((item): Line[] => {
        if (!item || typeof item !== 'object') return []
        const entry = item as Record<string, unknown>
        if (typeof entry.url !== 'string' || !/^https?:\/\//.test(entry.url)) {
          return []
        }
        return [
          {
            name:
              typeof entry.route === 'string' && entry.route
                ? entry.route
                : entry.url,
            url: entry.url.replace(/\/+$/, ''),
            note:
              typeof entry.description === 'string'
                ? entry.description
                : undefined,
          },
        ]
      })
    : []
  return lines.length > 0 ? lines : [{ name: '本站地址', url: origin }]
}

/** The line this page was opened on, else the first one */
export function pickLine(lines: Line[], origin: string): Line {
  return lines.find((line) => line.url === origin) ?? lines[0]
}

export type CodeLang = 'json' | 'toml' | 'env'

export type SetupTool = {
  id: 'claude-code' | 'codex' | 'gemini-cli' | 'pi' | 'opencode'
  label: string
  icon: string
  /** Where the settings go */
  file: string
  lang: CodeLang
  /** What to do with the snippet, the third step */
  how: string
  note: string
  guide: string
}

export const SETUP_TOOLS: SetupTool[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    icon: 'ClaudeCode',
    file: '~/.claude/settings.json',
    lang: 'json',
    how: '把这份配置写进 ~/.claude/settings.json，sk-你的密钥 换成刚才的密钥，再运行 claude。',
    note: '地址不带 /v1。想用 GPT 模型，把模型名换成 gpt-6.1-sol。',
    guide: '/docs/tools/claude-code/',
  },
  {
    id: 'codex',
    label: 'Codex',
    icon: 'Codex',
    file: '~/.codex/config.toml',
    lang: 'toml',
    how: '把密钥存进环境变量 XIAOXIONG_API_KEY，这几行写在 ~/.codex/config.toml 最前面，再运行 codex。',
    note: '地址要带 /v1。密钥从环境变量读，配置文件里不出现密钥。',
    guide: '/docs/tools/codex/',
  },
  {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    icon: 'GeminiCLI',
    file: '~/.gemini/.env',
    lang: 'env',
    how: '把这两行写进 ~/.gemini/.env，sk-你的密钥 换成刚才的密钥，再运行 gemini。',
    note: '地址不带 /v1beta。还要在 settings.json 里选用密钥登录，见完整教程。',
    guide: '/docs/tools/gemini-cli/',
  },
  {
    id: 'pi',
    label: 'Pi',
    icon: 'Pi',
    file: '~/.pi/agent/models.json',
    lang: 'json',
    how: '把密钥存进环境变量 XIAOXIONG_API_KEY，这份配置写进 ~/.pi/agent/models.json，再运行 pi。',
    note: 'GPT 模型的地址带 /v1，Claude 模型那一项不带。',
    guide: '/docs/tools/pi/',
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    icon: 'OpenCode',
    file: '~/.config/opencode/opencode.json',
    lang: 'json',
    how: '把密钥存进环境变量 XIAOXIONG_API_KEY，这份配置写进 ~/.config/opencode/opencode.json，再运行 opencode。',
    note: '地址带 /v1，Claude 模型也带。OpenCode 2 设好环境变量后，先运行一次 opencode service restart。',
    guide: '/docs/tools/opencode/',
  },
]

/** The settings file for a tool, pointed at one line */
export function setupSnippet(tool: SetupTool['id'], url: string): string {
  if (tool === 'codex') {
    return [
      'model = "gpt-6.1-sol"',
      'model_provider = "xiaoxiong"',
      '',
      '[model_providers.xiaoxiong]',
      'name = "小熊API"',
      `base_url = "${url}/v1"`,
      'env_key = "XIAOXIONG_API_KEY"',
      'wire_api = "responses"',
    ].join('\n')
  }
  if (tool === 'gemini-cli') {
    return ['GEMINI_API_KEY=sk-你的密钥', `GOOGLE_GEMINI_BASE_URL=${url}`].join(
      '\n'
    )
  }
  if (tool === 'pi') {
    // As on /docs/tools/pi/, one model of each kind; arrays stay on one line there too
    return [
      '{',
      '  "providers": {',
      '    "xiaoxiong": {',
      '      "name": "小熊API",',
      `      "baseUrl": "${url}/v1",`,
      '      "api": "openai-responses",',
      '      "apiKey": "$XIAOXIONG_API_KEY",',
      '      "models": [',
      '        {',
      '          "id": "gpt-6.1-sol",',
      '          "reasoning": true,',
      '          "input": ["text", "image"],',
      '          "contextWindow": 272000',
      '        },',
      '        {',
      '          "id": "claude-sonnet-4-6",',
      '          "api": "anthropic-messages",',
      `          "baseUrl": "${url}",`,
      '          "reasoning": true,',
      '          "input": ["text", "image"],',
      '          "contextWindow": 200000,',
      '          "maxTokens": 32000',
      '        }',
      '      ]',
      '    }',
      '  }',
      '}',
    ].join('\n')
  }
  if (tool === 'opencode') {
    // As on /docs/tools/opencode/ (run on OpenCode 1 and 2): one provider in
    // Claude's format, GPT through OpenAI's package, all at /v1
    return [
      '{',
      '  "$schema": "https://opencode.ai/config.json",',
      '  "model": "xiaoxiong/claude-sonnet-4-6",',
      '  "provider": {',
      '    "xiaoxiong": {',
      '      "npm": "@ai-sdk/anthropic",',
      '      "name": "小熊API",',
      '      "options": {',
      `        "baseURL": "${url}/v1",`,
      '        "apiKey": "{env:XIAOXIONG_API_KEY}"',
      '      },',
      '      "models": {',
      '        "claude-sonnet-4-6": {',
      '          "name": "Claude Sonnet 4.6",',
      '          "limit": { "context": 200000, "output": 32000 }',
      '        },',
      '        "glm-5": {',
      '          "name": "GLM-5",',
      '          "limit": { "context": 200000, "output": 32000 }',
      '        },',
      '        "gpt-6.1-sol": {',
      '          "name": "GPT-6.1 Sol",',
      '          "provider": { "npm": "@ai-sdk/openai" },',
      '          "limit": { "context": 272000, "output": 128000 }',
      '        }',
      '      }',
      '    }',
      '  }',
      '}',
    ].join('\n')
  }
  return JSON.stringify(
    {
      env: {
        ANTHROPIC_BASE_URL: url,
        ANTHROPIC_AUTH_TOKEN: 'sk-你的密钥',
        ANTHROPIC_MODEL: 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'gpt-6-luna',
        CLAUDE_CODE_SUBAGENT_MODEL: 'claude-sonnet-4-6',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      },
    },
    null,
    2
  )
}

/** The placeholder a reader has to replace with their own key */
export const KEY_PLACEHOLDER = 'sk-你的密钥'

export type CodeToken = {
  kind: 'key' | 'string' | 'fill' | 'punct' | 'plain'
  text: string
}

const JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|([{}[\],:])/g

/**
 * Splits a settings snippet into runs to colour: keys, strings, the key to
 * fill in, and punctuation. Everything else (spaces, numbers, true) is plain.
 */
export function highlight(code: string, lang: CodeLang): CodeToken[] {
  const out: CodeToken[] = []
  const push = (kind: CodeToken['kind'], text: string) => {
    if (!text) return
    const last = out.at(-1)
    if (last && last.kind === kind) last.text += text
    else out.push({ kind, text })
  }
  // a string, with the placeholder key picked out of it
  const pushString = (text: string) => {
    const at = text.indexOf(KEY_PLACEHOLDER)
    if (at < 0) return push('string', text)
    push('string', text.slice(0, at))
    push('fill', KEY_PLACEHOLDER)
    push('string', text.slice(at + KEY_PLACEHOLDER.length))
  }

  code.split('\n').forEach((line, index) => {
    if (index > 0) push('plain', '\n')
    if (lang === 'json') {
      let last = 0
      for (const match of line.matchAll(JSON_TOKEN)) {
        push('plain', line.slice(last, match.index))
        if (match[1] && match[2]) {
          push('key', match[1])
          push('punct', match[2])
        } else if (match[1]) {
          pushString(match[1])
        } else {
          push('punct', match[0])
        }
        last = match.index + match[0].length
      }
      push('plain', line.slice(last))
      return
    }
    const section = lang === 'toml' && /^\[.+\]$/.test(line.trim())
    if (section) return push('key', line)
    const pair = /^(\s*)([\w.-]+)(\s*=\s*)(.*)$/.exec(line)
    if (!pair) return push('plain', line)
    push('plain', pair[1])
    push('key', pair[2])
    push('punct', pair[3])
    pushString(pair[4])
  })
  return out
}

/** A model family (opens the model square on its vendor) or a tool (its guide) */
export type Logo = {
  icon: string
  name: string
  href?: string
  vendor?: string
}

/** The makers we sell, by the vendor names in the model square */
export const MODEL_LOGOS: Logo[] = [
  { icon: 'Claude', name: 'Claude', vendor: 'Anthropic' },
  { icon: 'OpenAI', name: 'OpenAI', vendor: 'OpenAI' },
  { icon: 'Gemini', name: 'Gemini', vendor: 'Google' },
  { icon: 'DeepSeek', name: 'DeepSeek', vendor: 'DeepSeek' },
  { icon: 'Qwen', name: 'Qwen', vendor: '阿里巴巴' },
  { icon: 'Kimi', name: 'Kimi', vendor: 'Moonshot' },
  { icon: 'Zhipu', name: 'GLM', vendor: '智谱' },
  { icon: 'Minimax', name: 'MiniMax', vendor: 'MiniMax' },
]

export const TOOL_LOGOS: Logo[] = [
  { icon: 'ClaudeCode', name: 'Claude Code', href: '/docs/tools/claude-code/' },
  { icon: 'Codex', name: 'Codex', href: '/docs/tools/codex/' },
  { icon: 'GeminiCLI', name: 'Gemini CLI', href: '/docs/tools/gemini-cli/' },
  { icon: 'Pi', name: 'Pi', href: '/docs/tools/pi/' },
  {
    icon: 'CherryStudio',
    name: 'Cherry Studio',
    href: '/docs/tools/cherry-studio/',
  },
  { icon: 'Cline', name: 'Cline', href: '/docs/tools/cline/' },
  { icon: 'Cursor', name: 'Cursor', href: '/docs/tools/cursor/' },
  { icon: 'OpenCode', name: 'OpenCode', href: '/docs/tools/opencode/' },
]

export type Endpoint = {
  name: string
  format: string
  routes: string[]
  usedBy: string
}

export const ENDPOINTS: Endpoint[] = [
  {
    name: 'Chat Completions',
    format: 'OpenAI',
    routes: ['POST /v1/chat/completions'],
    usedBy: 'OpenAI SDK、Cherry Studio、Cursor',
  },
  {
    name: 'Responses',
    format: 'OpenAI',
    routes: ['POST /v1/responses'],
    usedBy: 'Codex、Pi',
  },
  {
    name: 'Messages',
    format: 'Claude',
    routes: ['POST /v1/messages'],
    usedBy: 'Claude Code、Pi、Anthropic SDK',
  },
  {
    name: 'generateContent',
    format: 'Gemini',
    routes: ['POST /v1beta/models/{model}:generateContent'],
    usedBy: 'Gemini CLI、Google GenAI SDK',
  },
  {
    name: 'Images',
    format: 'OpenAI',
    routes: ['POST /v1/images/generations'],
    usedBy: 'gpt-image 系列',
  },
]

/** Credit per yuan and the share of the official price, when top-up is a deal */
export type Deal = { credit: string; share: string; rate: string }

const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function readDeal(price: unknown, usdRate: unknown): Deal | null {
  const p = Number(price)
  const r = Number(usdRate)
  if (!isDiscounted(p, r)) return null
  const percent = (p / r) * 100
  return {
    credit: NUMBER.format(1 / p),
    share: formatSharePercent(percent),
    rate: NUMBER.format(r),
  }
}

/** The one offer the first screen names, from the same numbers as the 活动 page */
export function heroOffer(offers: Offer[]): string | null {
  const starter = offers.find((o) => o.kind === 'starter')
  if (starter?.kind === 'starter') {
    return `新人礼包 ¥${NUMBER.format(starter.pay)} 得 $${NUMBER.format(starter.credit + starter.bonus)}`
  }
  const rate = offers.find((o) => o.kind === 'rate')
  return rate?.kind === 'rate'
    ? `充值 ¥1 得 $${NUMBER.format(rate.credit)} 额度`
    : null
}

export type Point = { title: string; body: string }

export function whyPoints(deal: Deal | null): Point[] {
  return [
    {
      title: '一个地址 四种格式',
      body: 'OpenAI、Claude、Gemini 格式都走同一个地址。Claude Code、Codex、Gemini CLI、Pi、OpenCode 改个地址就能用。',
    },
    deal
      ? {
          title: `¥1 = $${deal.credit} 额度`,
          body: `按官方美元价扣费，实付约是官方价的 ${deal.share}。充得多还送额度。`,
        }
      : {
          title: '按官方价扣费',
          body: '按模型广场上的美元价从余额扣费，没有订阅和月费。',
        },
    {
      title: '网页里直接用',
      body: '不装软件也能在控制台里聊天、画图，花的是同一份余额。',
    },
    {
      title: '每个密钥单独管',
      body: '额度上限、有效期、可用模型、IP 白名单，每个密钥单独设，随时停用。',
    },
    {
      title: '每次请求都有记录',
      body: '时间、模型、Token、花费、首字时间都在使用日志里，可以导出。',
    },
    {
      title: '状态公开',
      body: '模型广场里每个模型都有近 24 小时的状态条，出了问题一眼就能看到。',
    },
  ]
}

export type Faq = { q: string; a: string; href?: string; link?: string }

export function faqs(deal: Deal | null): Faq[] {
  return [
    {
      q: 'Base URL 要不要带 /v1？',
      a: '看工具会不会自己拼。OpenAI SDK、Codex、Cursor、Cline、OpenCode 要带 /v1。Claude Code 和 Anthropic SDK 不带。Gemini CLI 和 Google GenAI SDK 不带 /v1beta。Cherry Studio 带不带都行。',
    },
    {
      q: '支持 Claude、Gemini 和国产模型吗？',
      a: '支持。Claude、GPT、Gemini、DeepSeek、Qwen、Kimi、GLM、MiniMax 用同一个密钥，都能用 OpenAI 格式调用。Claude 和 Gemini 也能用自己的格式，国产几家也能用 Claude 格式。',
      href: '/pricing',
      link: '看看有哪些模型',
    },
    {
      q: '怎么计费？',
      a: `按模型广场上的美元价从余额扣：输入 token × 输入价 + 输出 token × 输出价，命中缓存的部分按缓存读取价。${deal ? `充值 ¥1 得 $${deal.credit} 额度。` : ''}`,
      href: '/docs/billing/',
      link: '计费说明',
    },
    {
      q: '怎么充值？多久到账？',
      a: '在控制台的钱包页选金额，用支付宝或微信扫码付款，通常十几秒到账。',
    },
    {
      q: '能生成图片吗？',
      a: '能。用 gpt-image 系列或 gemini-3.1-flash-image。不写代码的话，在控制台的「画图」页说一句话就能画。',
      href: '/docs/images/',
      link: '图片生成',
    },
    {
      q: '连不上或一直没有响应怎么办？',
      a: '先换一条线路：控制台 API 密钥页的「API 地址」里，绿色的线路可用。再把代理开着、关掉各试一次。',
      href: '/docs/lines/',
      link: '线路选择',
    },
    {
      q: '密钥泄露了怎么办？',
      a: '到 API 密钥页把它删掉，再建一个新的。删掉后，用旧密钥的请求会立即失败。',
    },
  ]
}

/** Models shown in the home page's price table, in this order when present */
export const FEATURED_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'gpt-6.1-sol',
  'gpt-6-luna',
  'gemini-3.8-flash',
  'gemini-3-flash',
]
