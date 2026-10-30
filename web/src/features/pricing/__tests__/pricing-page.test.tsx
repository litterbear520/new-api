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
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import i18n from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { Route as PricingRoute } from '@/routes/pricing/index'

import { Pricing } from '..'

vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))

const LEAD = 'Charged at official USD prices. ¥1 buys {{credit}} of credit.'

const PRICING = {
  success: true,
  data: [
    {
      id: 1,
      model_name: 'chat-model',
      vendor_id: 1,
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 1,
      enable_groups: ['default'],
      tags: 'chat',
      supported_endpoint_types: ['openai'],
    },
    {
      id: 2,
      model_name: 'per-call-model',
      vendor_id: 1,
      quota_type: 1,
      model_price: 0.1,
      model_ratio: 0,
      completion_ratio: 0,
      enable_groups: ['default'],
      tags: 'image',
      supported_endpoint_types: ['image-generation'],
    },
  ],
  vendors: [{ id: 1, name: 'Vendor A' }],
  group_ratio: { default: 1 },
  usable_group: { default: { desc: '', ratio: 1 } },
  supported_endpoint: {},
  auto_groups: [],
}

const clients: QueryClient[] = []

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/api/pricing') return { data: PRICING }
    if (url === '/api/notice') return { data: { success: true, data: '' } }
    if (url === '/api/status') {
      return {
        data: { success: true, data: { price: 0.1, usd_exchange_rate: 7 } },
      }
    }
    return { data: { success: true, data: { models: [] } } }
  })
})

afterEach(async () => {
  clients.splice(0).forEach((client) => client.clear())
  await i18n.changeLanguage('en')
})

async function renderPricing(entry: string, firstModel = 'chat-model') {
  const root = createRootRoute()
  const pricing = createRoute({
    getParentRoute: () => root,
    path: 'pricing/',
    validateSearch: PricingRoute.options.validateSearch,
    component: Pricing,
  })
  const router = createRouter({
    routeTree: root.addChildren([pricing]),
    history: createMemoryHistory({ initialEntries: [entry] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await screen.findByRole('heading', { name: firstModel })
}

describe('pricing page', () => {
  it('lists every model for an old bookmark with an endpoint or unknown billing type', async () => {
    // The values as an older sidebar wrote them into the URL
    await renderPricing('/pricing/?quotaType=%220%22&endpointType=anthropic')
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    ).toEqual(['chat-model', 'per-call-model'])
  })

  it.each([
    ['a tag', '/pricing/?tag=image'],
    ['a billing type', '/pricing/?quotaType=request'],
  ])('applies %s from the URL', async (_label, entry) => {
    await renderPricing(entry, 'per-call-model')
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    ).toEqual(['per-call-model'])
  })

  it('still applies the filters the bar shows, such as a search', async () => {
    await renderPricing('/pricing/?search=per-call', 'per-call-model')
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    ).toEqual(['per-call-model'])
  })

  it.each([
    [
      'zhCN',
      '按官方美元价扣费，充值 ¥1 得 {{credit}} 额度。',
      '按官方美元价扣费，充值 ¥1 得 $10 额度。',
    ],
    [
      'fr',
      'Facturé aux prix officiels en USD. 1 ¥ donne {{credit}} de crédit.',
      'Facturé aux prix officiels en USD. 1 ¥ donne 10 $ de crédit.',
    ],
  ])('says what ¥1 buys the %s way', async (language, translation, lead) => {
    i18n.addResourceBundle(language, 'translation', { [LEAD]: translation })
    await i18n.changeLanguage(language)
    try {
      await renderPricing('/pricing/')
      expect(screen.getByText(lead)).toBeVisible()
    } finally {
      i18n.removeResourceBundle(language, 'translation')
    }
  })
})
