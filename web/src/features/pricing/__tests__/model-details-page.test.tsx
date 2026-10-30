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
import { cleanup, render, screen, within } from '@testing-library/react'
import i18n from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { ModelDetailsContent } from '../components/model-details'
import type { PricingModel } from '../types'

vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({
    to,
    params: _params,
    search,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string
    params?: Record<string, string>
    search?: Record<string, string>
  }) => (
    <a href={search?.model ? `${to}?model=${search.model}` : to} {...rest}>
      {children}
    </a>
  ),
}))

const opus: PricingModel = {
  id: 1,
  model_name: 'claude-opus-4-6',
  vendor_name: 'Anthropic',
  quota_type: 0,
  model_ratio: 2.5,
  completion_ratio: 5,
  cache_ratio: 0.1,
  create_cache_ratio: 1.25,
  enable_groups: ['default', 'team_a'],
  supported_endpoint_types: ['anthropic', 'openai'],
}

const PAY_NOTE =
  'Prices are in USD and come off your balance. ¥1 buys {{credit}} of credit, so you pay about {{percent}} of the official price ($1 = ¥{{rate}}).'

const clients: QueryClient[] = []
afterEach(async () => {
  await i18n.changeLanguage('en')
  cleanup()
  for (const client of clients.splice(0)) client.clear()
  vi.restoreAllMocks()
})

function renderDetails(
  model: PricingModel,
  usableGroup: Record<string, { desc: string; ratio: number }> = {
    default: { desc: '', ratio: 1 },
  },
  groupRatio: Record<string, number> = { default: 1, team_a: 1 },
  tokenUnit: 'M' | 'K' = 'M'
) {
  vi.spyOn(api, 'get').mockResolvedValue({ data: { data: { groups: [] } } })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <ModelDetailsContent
        model={model}
        groupRatio={groupRatio}
        usableGroup={usableGroup}
        endpointMap={{
          anthropic: { path: '/v1/messages', method: 'POST' },
          openai: { path: '/v1/chat/completions', method: 'POST' },
        }}
        autoGroups={[]}
        priceRate={0.1}
        usdExchangeRate={7}
        tokenUnit={tokenUnit}
      />
    </QueryClientProvider>
  )
}

describe('model details page', () => {
  it('stacks pricing, stability and API sections instead of tabs', () => {
    renderDetails(opus)
    for (const name of ['Overview', 'Performance', 'API']) {
      expect(screen.queryByRole('tab', { name })).not.toBeInTheDocument()
    }
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    ).toEqual(
      expect.arrayContaining([
        'Pricing',
        'Stability & performance',
        'How to call it',
      ])
    )
  })

  it('offers chat with this model, an API key and the coding tool guide', () => {
    renderDetails(opus)
    expect(screen.getByRole('link', { name: 'Try in chat' })).toHaveAttribute(
      'href',
      '/playground?model=claude-opus-4-6'
    )
    expect(screen.getByRole('link', { name: 'Get API key' })).toHaveAttribute(
      'href',
      '/keys'
    )
    expect(
      within(screen.getByRole('list', { name: 'Works with' })).getByRole(
        'link',
        { name: 'Claude Code' }
      )
    ).toHaveAttribute('href', '/docs/tools/claude-code/')
  })

  it('sends image models to the drawing page', () => {
    renderDetails({
      ...opus,
      model_name: 'gpt-image-2',
      vendor_name: 'OpenAI',
      supported_endpoint_types: ['image-generation', 'openai'],
    })
    expect(
      screen.getByRole('link', { name: 'Try in drawing' })
    ).toHaveAttribute('href', '/draw')
    expect(
      screen.queryByRole('link', { name: 'Try in chat' })
    ).not.toBeInTheDocument()
  })

  it('shows the balance price, the yuan cost and the official price per 1M tokens', () => {
    renderDetails(opus)
    const row = (name: RegExp) =>
      screen.getByRole('rowheader', { name }).closest('tr') as HTMLElement
    expect(row(/From your balance/)).toHaveTextContent(
      'From your balance$5$25$0.5$6.25'
    )
    expect(row(/You pay/)).toHaveTextContent(
      '1.4% of official¥0.5¥2.5¥0.05¥0.625'
    )
    expect(row(/Official price/)).toHaveTextContent(
      'Official price¥35¥175¥3.5¥43.75'
    )
    expect(
      screen.getByText(/you pay about 1\.4% of the official price/)
    ).toBeVisible()
  })

  it('prices every row per 1K tokens when the unit is K', () => {
    renderDetails(opus, undefined, undefined, 'K')
    const row = (name: RegExp) =>
      screen.getByRole('rowheader', { name }).closest('tr') as HTMLElement
    expect(
      screen.getByRole('columnheader', { name: 'Per 1K tokens' })
    ).toBeInTheDocument()
    expect(row(/From your balance/)).toHaveTextContent(
      'From your balance$0.005$0.025'
    )
    expect(row(/You pay/)).toHaveTextContent('1.4% of official¥0.0005¥0.0025')
    expect(row(/Official price/)).toHaveTextContent(
      'Official price¥0.035¥0.175'
    )
  })

  it('shows the headline prices and API formats under the title', () => {
    renderDetails(opus)
    const strip = screen.getByText('API formats').closest('dl') as HTMLElement
    expect(strip).toHaveTextContent('$5/1M≈ ¥0.5')
    expect(strip).toHaveTextContent('Anthropic · OpenAI')
  })

  it.each([
    [
      'zhCN',
      '价格以美元计，从余额扣除。充值 ¥1 得 {{credit}} 额度，实付约为官方价的 {{percent}}（按 $1 = ¥{{rate}} 计）。',
      '价格以美元计，从余额扣除。充值 ¥1 得 $10 额度，实付约为官方价的 1.4%（按 $1 = ¥7 计）。',
      '¥0.5',
    ],
    [
      'fr',
      'Les prix sont en USD et sont déduits de votre solde. 1 ¥ donne {{credit}} de crédit, vous payez donc environ {{percent}} du prix officiel (1 $ = {{rate}} ¥).',
      'Les prix sont en USD et sont déduits de votre solde. 1 ¥ donne 10 $ de crédit, vous payez donc environ 1.4% du prix officiel (1 $ = 7 ¥).',
      '0,5 ¥',
    ],
  ])(
    'writes the top-up rate and yuan prices the %s way',
    async (language, translation, note, yuan) => {
      i18n.addResourceBundle(language, 'translation', {
        [PAY_NOTE]: translation,
      })
      await i18n.changeLanguage(language)
      try {
        renderDetails(opus)
        expect(screen.getByText(note)).toBeVisible()
        const pay = screen
          .getByRole('rowheader', { name: /You pay/ })
          .closest('tr') as HTMLElement
        expect(within(pay).getAllByRole('cell')[0]).toHaveTextContent(yuan)
      } finally {
        i18n.removeResourceBundle(language, 'translation')
      }
    }
  )

  it('hides the group table when the only group costs the base price', () => {
    renderDetails(opus)
    expect(screen.queryByText('Pricing by Group')).not.toBeInTheDocument()
  })

  it('shows the group table for several groups or a priced single group', () => {
    const { unmount } = renderDetails(opus, {
      default: { desc: '', ratio: 1 },
      team_a: { desc: '', ratio: 1 },
    })
    expect(screen.getByText('Pricing by Group')).toBeVisible()
    unmount()
    renderDetails(opus, { default: { desc: '', ratio: 0.8 } }, { default: 0.8 })
    expect(screen.getByText('Pricing by Group')).toBeVisible()
  })

  it('keeps only real API facts: samples read the documented key, no guessed limits', () => {
    renderDetails(opus)
    expect(
      screen.getByText(/The key is read from the environment variable/)
    ).toHaveTextContent(
      'The key is read from the environment variable XIAOXIONG_API_KEY; create one on the API keys page.'
    )
    expect(screen.queryByText('Supported parameters')).not.toBeInTheDocument()
    expect(screen.queryByText('Rate limits')).not.toBeInTheDocument()
  })
})
