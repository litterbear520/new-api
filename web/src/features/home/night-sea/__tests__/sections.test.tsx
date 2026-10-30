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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { walletKeys } from '@/features/bear-wallet/constants'
import { STATUS_QUERY_KEY } from '@/lib/status-query'

import { HomeEnd, HomeSections } from '../sections'
import {
  highlight,
  pickLine,
  readDeal,
  readLines,
  setupSnippet,
} from '../sections-content'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({
    to,
    search: _search,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string
    search?: unknown
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const LINES = [
  {
    id: 1,
    route: '主线路',
    url: 'https://api.example.com/',
    description: '推荐',
  },
  { id: 2, route: '备用线路 1', url: 'https://backup.example.com' },
  { id: 3, route: '坏的', url: 'ftp://nope' },
]

describe('home sections content', () => {
  it('reads the api_info lines, trims the slash and skips bad entries', () => {
    expect(readLines(LINES, 'http://localhost')).toEqual([
      { name: '主线路', url: 'https://api.example.com', note: '推荐' },
      {
        name: '备用线路 1',
        url: 'https://backup.example.com',
        note: undefined,
      },
    ])
    expect(readLines(undefined, 'http://localhost')).toEqual([
      { name: '本站地址', url: 'http://localhost' },
    ])
  })

  it('picks the line the page is on, else the first', () => {
    const lines = readLines(LINES, 'x')
    expect(pickLine(lines, 'https://backup.example.com').name).toBe(
      '备用线路 1'
    )
    expect(pickLine(lines, 'http://localhost').name).toBe('主线路')
  })

  it('points each tool at the line the way its docs say', () => {
    const url = 'https://api.example.com'
    expect(
      JSON.parse(setupSnippet('claude-code', url)).env.ANTHROPIC_BASE_URL
    ).toBe(url)
    expect(setupSnippet('codex', url)).toContain(`base_url = "${url}/v1"`)
    expect(setupSnippet('codex', url)).toContain(
      'env_key = "XIAOXIONG_API_KEY"'
    )
    expect(setupSnippet('gemini-cli', url)).toContain(
      `GOOGLE_GEMINI_BASE_URL=${url}`
    )
    expect(setupSnippet('gemini-cli', url)).not.toContain('/v1beta')
  })

  it('gives Pi the two models from its docs page, GPT with /v1 and Claude without', () => {
    const url = 'https://api.example.com'
    const pi = JSON.parse(setupSnippet('pi', url))
    const provider = pi.providers.xiaoxiong
    expect(provider).toMatchObject({
      baseUrl: `${url}/v1`,
      api: 'openai-responses',
      apiKey: '$XIAOXIONG_API_KEY',
    })
    expect(provider.models).toEqual([
      {
        id: 'gpt-6.1-sol',
        reasoning: true,
        input: ['text', 'image'],
        contextWindow: 272000,
      },
      {
        id: 'claude-sonnet-4-6',
        api: 'anthropic-messages',
        baseUrl: url,
        reasoning: true,
        input: ['text', 'image'],
        contextWindow: 200000,
        maxTokens: 32000,
      },
    ])
  })

  it('gives OpenCode one provider for all its models, each at /v1, the key from the environment', () => {
    const url = 'https://api.example.com'
    const code = setupSnippet('opencode', url)
    const config = JSON.parse(code)
    expect(config.model).toBe('xiaoxiong/claude-sonnet-4-6')
    const provider = config.provider.xiaoxiong
    expect(provider).toMatchObject({
      npm: '@ai-sdk/anthropic',
      options: { baseURL: `${url}/v1`, apiKey: '{env:XIAOXIONG_API_KEY}' },
    })
    expect(Object.keys(provider.models)).toEqual([
      'claude-sonnet-4-6',
      'glm-5',
      'gpt-6.1-sol',
    ])
    // GPT goes to the Responses API through OpenAI's package
    expect(provider.models['gpt-6.1-sol'].provider).toEqual({
      npm: '@ai-sdk/openai',
    })
    for (const model of Object.values(provider.models)) {
      expect(model).toHaveProperty('limit.context')
      expect(model).toHaveProperty('limit.output')
    }
    expect(code).not.toContain('sk-')
  })

  it('colours the settings without losing a character, and picks out the key to fill in', () => {
    const url = 'https://api.example.com'
    for (const [tool, lang] of [
      ['claude-code', 'json'],
      ['codex', 'toml'],
      ['gemini-cli', 'env'],
      ['pi', 'json'],
      ['opencode', 'json'],
    ] as const) {
      const code = setupSnippet(tool, url)
      expect(
        highlight(code, lang)
          .map((token) => token.text)
          .join('')
      ).toBe(code)
    }

    const json = highlight(setupSnippet('claude-code', url), 'json')
    expect(json.filter((t) => t.kind === 'fill')).toEqual([
      { kind: 'fill', text: 'sk-你的密钥' },
    ])
    expect(json.find((t) => t.kind === 'key')?.text).toBe('"env"')

    const toml = highlight(setupSnippet('codex', url), 'toml')
    expect(toml).toContainEqual({
      kind: 'key',
      text: '[model_providers.xiaoxiong]',
    })
    expect(toml).toContainEqual({ kind: 'key', text: 'wire_api' })

    expect(highlight('GEMINI_API_KEY=sk-你的密钥', 'env')).toEqual([
      { kind: 'key', text: 'GEMINI_API_KEY' },
      { kind: 'punct', text: '=' },
      { kind: 'fill', text: 'sk-你的密钥' },
    ])
  })

  it('works out the deal from the top-up price and the exchange rate', () => {
    expect(readDeal(0.1, 7)).toEqual({ credit: '10', share: '1.4%', rate: '7' })
    expect(readDeal(7, 7)).toBeNull()
    expect(readDeal(undefined, 7)).toBeNull()
  })
})

const pricing = {
  success: true,
  data: [
    {
      id: 1,
      model_name: 'claude-opus-4-6',
      vendor_id: 2,
      quota_type: 0,
      model_ratio: 2.5,
      completion_ratio: 5,
      enable_groups: ['default'],
    },
    {
      id: 2,
      model_name: 'gpt-6-luna',
      vendor_id: 1,
      quota_type: 0,
      model_ratio: 0.05,
      completion_ratio: 5,
      enable_groups: ['default'],
      billing_mode: 'tiered_expr',
      billing_expr:
        '((len <= 272000)) ? (tier("standard", p * 0.1 + c * 0.5)) : (tier("long_context", p * 0.2 + c * 0.75))',
    },
    {
      id: 3,
      model_name: 'gpt-image-2',
      vendor_id: 1,
      quota_type: 0,
      model_ratio: 37.5,
      completion_ratio: 2,
      enable_groups: ['default'],
      supported_endpoint_types: ['image-generation'],
    },
  ],
  vendors: [
    { id: 1, name: 'OpenAI', icon: 'OpenAI' },
    { id: 2, name: 'Anthropic', icon: 'Claude.Color' },
  ],
  group_ratio: { default: 1 },
  usable_group: {},
  supported_endpoint: {},
  auto_groups: [],
}

const clients: QueryClient[] = []
afterEach(() => {
  cleanup()
  for (const client of clients.splice(0)) client.clear()
})

function renderSections(isAuthenticated = false, price = 0.1) {
  const client = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  })
  clients.push(client)
  client.setQueryData(STATUS_QUERY_KEY, {
    price,
    usd_exchange_rate: 7,
    api_info_enabled: true,
    api_info: LINES,
  })
  client.setQueryData(['pricing'], pricing)
  client.setQueryData(walletKeys.rules, {
    tiers: [
      { min: 10, rate: 0.03 },
      { min: 500, rate: 0.2 },
    ],
    first: { pay: 6, bonus: 40, days: 30, planId: 3 },
    invite: { inviter: 5, invitee: 5 },
    bonusDays: 90,
    bonusPlanId: 1,
    giftPlanId: 2,
  })
  const onAuth = vi.fn()
  const authClick = vi.fn((view: string) =>
    isAuthenticated
      ? undefined
      : (e: React.MouseEvent) => {
          e.preventDefault()
          onAuth(view)
        }
  )
  const props = { name: '小熊API', isAuthenticated, authClick }
  render(
    <QueryClientProvider client={client}>
      <main>
        <HomeSections {...props} />
      </main>
      <HomeEnd {...props} />
    </QueryClientProvider>
  )
  return { onAuth }
}

describe('home sections', () => {
  it('shows the sections in order, the way in last', () => {
    renderSections()
    expect(screen.getByText('支持的模型和工具')).toBeVisible()
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    ).toEqual([
      '一个地址 连上所有模型',
      '三步接入 现有工具直接用',
      '用多少 付多少',
      '接入之前 常被问到的',
      '小船已经备好 星海等你出发',
    ])
  })

  it('names Pi among the tools and links each tool to its guide', () => {
    renderSections()
    const tools = screen.getByRole('list', { name: '工具' })
    expect(within(tools).getByRole('link', { name: 'Pi' })).toHaveAttribute(
      'href',
      '/docs/tools/pi/'
    )
    // the name follows the icon, which jsdom fills with a letter
    expect(
      within(tools)
        .getAllByRole('link')
        .map((link) => link.lastChild?.textContent)
    ).toEqual([
      'Claude Code',
      'Codex',
      'Gemini CLI',
      'Pi',
      'Cherry Studio',
      'Cline',
      'Cursor',
      'OpenCode',
    ])
  })

  it('ends with the footer links, outside the main part of the page', () => {
    renderSections()
    const footer = screen.getByRole('contentinfo')
    expect(
      within(footer).getByRole('navigation', { name: '页脚' })
    ).toHaveTextContent('模型广场活动文档更新日志')
    expect(footer.closest('main')).toBeNull()
  })

  it('writes the chosen tool and line into the snippet and the third step', async () => {
    const user = userEvent.setup()
    renderSections()
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent(
      '"ANTHROPIC_BASE_URL": "https://api.example.com"'
    )
    await user.click(screen.getByRole('button', { name: '备用线路 1' }))
    expect(panel).toHaveTextContent(
      '"ANTHROPIC_BASE_URL": "https://backup.example.com"'
    )
    await user.click(screen.getByRole('tab', { name: 'Codex' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'base_url = "https://backup.example.com/v1"'
    )
    expect(screen.getByRole('tab', { name: 'Codex' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('heading', { name: '填进 Codex' })).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Codex 完整教程 →' })
    ).toHaveAttribute('href', '/docs/tools/codex/')
  })

  it('scrolls a tab row wider than the card to the chosen tab, and only the row', async () => {
    const user = userEvent.setup()
    renderSections()
    const row = screen.getByRole('tablist', { name: '工具' })
    const opencode = screen.getByRole('tab', { name: 'OpenCode' })
    // a phone: the row shows 0..300 px, OpenCode sits at 320..400
    const box = (left: number, right: number) =>
      ({
        left,
        right,
        top: 0,
        bottom: 40,
        width: right - left,
        height: 40,
      }) as DOMRect
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(box(0, 300))
    vi.spyOn(opencode, 'getBoundingClientRect').mockReturnValue(box(320, 400))
    const pageScroll = vi.spyOn(window, 'scrollTo')

    await user.click(opencode)
    expect(row.scrollLeft).toBe(112)
    expect(pageScroll).not.toHaveBeenCalled()
  })

  it('fades the side of the tab row where more tabs are out of view', () => {
    // a phone: 500 px of tabs in a 300 px row
    const size = (wide: number) =>
      function (this: Element) {
        return this.getAttribute('role') === 'tablist' ? wide : 0
      }
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(
      size(500)
    )
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(
      size(300)
    )
    renderSections()
    const row = screen.getByRole('tablist', { name: '工具' })
    expect(row).toHaveAttribute('data-overflow', 'end')

    row.scrollLeft = 100
    fireEvent.scroll(row)
    expect(row).toHaveAttribute('data-overflow', 'both')

    row.scrollLeft = 200
    fireEvent.scroll(row)
    expect(row).toHaveAttribute('data-overflow', 'start')
  })

  it('shows the tab row without a fade when every tab fits', () => {
    renderSections()
    expect(screen.getByRole('tablist', { name: '工具' })).not.toHaveAttribute(
      'data-overflow'
    )
  })

  it('moves along the tool tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    renderSections()
    const first = screen.getByRole('tab', { name: 'Claude Code' })
    expect(first).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Pi' })).toHaveAttribute(
      'tabindex',
      '-1'
    )
    first.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Codex' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Codex' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'OpenCode' })).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      '"npm": "@ai-sdk/anthropic"'
    )
    expect(
      screen.getByRole('link', { name: 'OpenCode 完整教程 →' })
    ).toHaveAttribute('href', '/docs/tools/opencode/')
    await user.keyboard('{ArrowRight}')
    expect(first).toHaveFocus()
  })

  it('prices the featured chat models in dollars and yuan, without image models', () => {
    renderSections()
    const table = screen.getByRole('table')
    const opus = within(table)
      .getByText('claude-opus-4-6')
      .closest('tr') as HTMLElement
    expect(opus).toHaveTextContent('$5≈ ¥0.5$25≈ ¥2.5')
    const luna = within(table)
      .getByText('gpt-6-luna')
      .closest('tr') as HTMLElement
    expect(luna).toHaveTextContent('$0.1≈ ¥0.01$0.5≈ ¥0.05')
    expect(within(table).queryByText('gpt-image-2')).not.toBeInTheDocument()
  })

  it('states the deal and the pay-bridge perks', () => {
    renderSections()
    expect(screen.getByText('¥1 = $10')).toBeVisible()
    expect(
      screen.getByText('新人礼包：¥6 得 $60 余额，再送 $40 限时额度（30 天）。')
    ).toBeVisible()
    const tiers = screen.getByRole('list', { name: '单笔充值满额加送' })
    expect(
      within(tiers)
        .getAllByRole('listitem')
        .map((tier) => tier.textContent)
    ).toEqual(['¥10送 3%', '¥500送 20%'])
    expect(screen.getByText('加送的额度 90 天内有效')).toBeVisible()
    expect(screen.getByText('邀请朋友注册，你得 $5，朋友得 $5。')).toBeVisible()
    expect(screen.getByRole('link', { name: '全部活动 →' })).toHaveAttribute(
      'href',
      '/activity'
    )
  })

  it('opens sign-up from the calls to action when signed out', async () => {
    const user = userEvent.setup()
    const { onAuth } = renderSections()
    await user.click(screen.getByRole('link', { name: '开始使用' }))
    expect(onAuth).toHaveBeenCalledWith('sign-up')
    await user.click(screen.getByRole('link', { name: '去创建 →' }))
    expect(onAuth).toHaveBeenLastCalledWith('sign-in')
  })

  it('goes straight to the wallet when signed in', () => {
    renderSections(true)
    expect(screen.getByRole('link', { name: '去充值' })).toHaveAttribute(
      'href',
      '/wallet'
    )
    expect(screen.getByRole('link', { name: '开始使用' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
  })

  it('names no 新人礼包 and no tier a payment cannot reach when the price makes ¥6 charge ¥6.3', () => {
    // At ¥0.7 per dollar ¥6 buys $9, charged ¥6.3: pay-bridge gives no gift,
    // and ¥10 / ¥500 charge ¥9.8 / ¥499.8, below their tiers (as on /activity).
    renderSections(false, 0.7)
    expect(screen.queryAllByText(/新人礼包/)).toHaveLength(0)
    expect(
      screen.queryByRole('list', { name: '单笔充值满额加送' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('邀请朋友注册，你得 $5，朋友得 $5。')).toBeVisible()
  })

  it('names the 新人礼包 in the first step with the numbers it is charged at', () => {
    renderSections()
    expect(
      screen.getByText(/新人礼包：¥6 得 \$60 余额，再送 \$40 限时额度。/)
    ).toBeVisible()
  })
})

describe('home sections copy button', () => {
  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(navigator, 'clipboard')
    Reflect.deleteProperty(document, 'execCommand')
  })

  const copyButton = () =>
    within(screen.getByRole('tabpanel')).getByRole('button')

  it('copies the settings, says so for a moment, then offers to copy again', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    renderSections()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    await act(async () => {
      fireEvent.click(copyButton())
    })
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('"ANTHROPIC_BASE_URL"')
    )
    expect(copyButton()).toHaveTextContent(/^已复制$/)

    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(copyButton()).toHaveTextContent(/^复制$/)
  })

  it('still copies where the browser has no clipboard API, as in-app browsers on plain HTTP', async () => {
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })
    renderSections()

    await act(async () => {
      fireEvent.click(copyButton())
    })
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(copyButton()).toHaveTextContent(/^已复制$/)
  })

  it('asks to copy by hand when every way of copying fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: () => false,
    })
    renderSections()

    await act(async () => {
      fireEvent.click(copyButton())
    })
    expect(copyButton()).toHaveTextContent(/^请手动复制$/)
  })
})
