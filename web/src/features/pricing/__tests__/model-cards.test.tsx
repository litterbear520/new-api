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
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'

import { api } from '@/lib/api'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { CachedPriceCell } from '../components/cached-price-cell'
import { ModelCard } from '../components/model-card'
import { ModelCardGrid } from '../components/model-card-grid'
import type { PricingModel } from '../types'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({
    to,
    params,
    search: _search,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string
    params?: Record<string, string>
    search?: unknown
  }) => (
    <a
      href={params?.modelId ? to.replace('$modelId', params.modelId) : to}
      {...rest}
    >
      {children}
    </a>
  ),
}))

function pricingModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'example-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 3,
    enable_groups: ['default', 'premium'],
    group_ratio: { default: 1, premium: 3 },
    ...overrides,
  }
}

let queryClient: QueryClient
const originalStorage = useSystemConfigStore.persist.getOptions().storage
beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size
    },
  })
  useSystemConfigStore.persist.setOptions({
    storage: createJSONStorage(() => localStorage),
  })
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'USD' },
  })
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
})
afterEach(() => {
  queryClient.clear()
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useSystemConfigStore.persist.setOptions({ storage: originalStorage })
})

describe('model cards', () => {
  it('shows separate generic and image cache prices including a free image cache', () => {
    render(
      <CachedPriceCell
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr:
            'tier("standard", p * 5 + cr * 1.25 + img * 8 + img_cr * 0 + c * 30)',
        })}
        options={{ tokenUnit: 'M' }}
      />
    )
    expect(screen.getByText('Cache Read').parentElement).toHaveTextContent(
      '$1.25'
    )
    expect(screen.getByText('Image Cache').parentElement).toHaveTextContent(
      '$0'
    )
  })
  it('shows fixed prices per request without a token unit', () => {
    render(
      <ModelCard
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("request", fixed(0.01))',
        })}
      />
    )
    expect(screen.getByText('$0.01')).toBeVisible()
    expect(screen.getByText('/request')).toBeVisible()
    expect(screen.queryByText('/1M')).not.toBeInTheDocument()
  })

  it('copies the complete long model name and links the card to its details', async () => {
    const user = userEvent.setup()
    const name = 'provider/model-with-a-long-name-and-a-version-suffix-20260906'
    render(<ModelCard model={pricingModel({ model_name: name })} />)
    expect(screen.getByRole('heading', { name })).toHaveAttribute('title', name)
    await user.click(screen.getByRole('button', { name: 'Copy model name' }))
    expect(await navigator.clipboard.readText()).toBe(name)
    expect(screen.getByRole('link', { name })).toHaveAttribute(
      'href',
      `/pricing/${name}`
    )
  })

  it('shows an empty 24-hour strip and no placeholder text when nothing is known', () => {
    render(<ModelCard model={pricingModel()} />)
    const strip = screen.getByRole('img', {
      name: 'No requests in the last 24 hours',
    })
    expect(strip.children).toHaveLength(24)
    for (const slot of strip.children) {
      expect(slot).toHaveClass('bg-muted-foreground/15')
    }
    expect(
      screen.queryByText('No description available.')
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it.each([
    ['claude-opus-4-6', 'Anthropic', 'Claude Code', '/docs/tools/claude-code/'],
    ['gpt-5.6-sol', 'OpenAI', 'Codex', '/docs/tools/codex/'],
    ['gemini-3-flash', 'Google', 'Gemini CLI', '/docs/tools/gemini-cli/'],
  ])('links %s (%s) to the %s guide', (name, vendor, tool, href) => {
    render(
      <ModelCard
        model={pricingModel({ model_name: name, vendor_name: vendor })}
      />
    )
    const tools = screen.getByRole('list', { name: 'Works with' })
    expect(within(tools).getByRole('link', { name: tool })).toHaveAttribute(
      'href',
      href
    )
  })

  it('sends image models to the drawing page instead of a coding tool', () => {
    render(
      <ModelCard
        model={pricingModel({
          model_name: 'gpt-image-2',
          vendor_name: 'OpenAI',
          supported_endpoint_types: ['image-generation', 'openai'],
        })}
      />
    )
    const tools = screen.getByRole('list', { name: 'Works with' })
    expect(
      within(tools).getByRole('link', { name: 'Draw pictures' })
    ).toHaveAttribute('href', '/draw')
    expect(within(tools).queryByText('Codex')).not.toBeInTheDocument()
  })

  it('keeps groups, endpoints, tags and the plain token label off the card', () => {
    render(
      <ModelCard
        model={pricingModel({
          supported_endpoint_types: ['openai', 'anthropic'],
          tags: 'fast,batch',
        })}
      />
    )
    expect(screen.queryByText('Groups')).not.toBeInTheDocument()
    expect(screen.queryByText('Endpoints')).not.toBeInTheDocument()
    expect(screen.queryByText('Tags')).not.toBeInTheDocument()
    expect(screen.queryByText('Token-based')).not.toBeInTheDocument()
  })

  it('shows group prices with what they cost in yuan, including a free cache price', () => {
    render(
      <ModelCard
        model={pricingModel({ cache_ratio: 0 })}
        selectedGroup='premium'
        priceRate={0.1}
        usdExchangeRate={7}
      />
    )
    expect(screen.getByText('Input').parentElement).toHaveTextContent(
      /\$6\/1M≈ ¥0\.6$/
    )
    expect(screen.getByText('Output').parentElement).toHaveTextContent(
      /\$18\/1M≈ ¥1\.8$/
    )
    expect(screen.getByText('Cache Read').parentElement).toHaveTextContent(
      /\$0\/1M≈ ¥0$/
    )
  })

  it('shows a per-request price with the selected group and its yuan cost', () => {
    render(
      <ModelCard
        model={pricingModel({ quota_type: 1, model_price: 0.4 })}
        selectedGroup='premium'
        priceRate={0.1}
        usdExchangeRate={7}
      />
    )
    expect(
      screen.getByText('$1.2').parentElement?.parentElement
    ).toHaveTextContent(/\$1\.2\/request≈ ¥0\.12$/)
    expect(screen.queryByText(/1K|1M/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Per Request')).toHaveLength(1)
  })

  it('shows expression prices per 1M tokens for the selected group', () => {
    render(
      <ModelCard
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", p * 3 + c * 15)',
        })}
        selectedGroup='premium'
        priceRate={0.1}
        usdExchangeRate={7}
      />
    )
    expect(screen.getByText('Input').parentElement).toHaveTextContent(
      /\$9\/1M≈ ¥0\.9$/
    )
    expect(screen.getByText('Output').parentElement).toHaveTextContent(
      /\$45\/1M≈ ¥4\.5$/
    )
  })

  it('updates the current time tier at a minute boundary and after returning to the page', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T08:59:59+08:00'))
    const model = pricingModel({
      billing_mode: 'tiered_expr',
      billing_expr:
        'hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12 ? tier("peak", p * 3 + c * 9) : tier("off_peak", p * 1.5 + c * 4.5)',
    })
    render(<ModelCard model={model} />)
    expect(screen.getByText('Current period price')).toBeVisible()
    expect(screen.getByText('$1.5')).toBeVisible()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText('$3')).toBeVisible()
    act(() => {
      vi.setSystemTime(new Date('2026-09-07T12:00:00+08:00'))
      fireEvent(document, new Event('visibilitychange'))
    })
    expect(screen.getByText('$1.5')).toBeVisible()
  })

  it('shows the cache read price of an expression model after its input and output prices', () => {
    render(
      <ModelCard
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", p * 0.15 + c * 0.6 + cr * 0.003)',
        })}
        selectedGroup='default'
      />
    )
    expect(screen.getByText('Input').parentElement).toHaveTextContent(
      /\$0.15\s*\/\s*1M/
    )
    expect(screen.getByText('Output').parentElement).toHaveTextContent(
      /\$0.6\s*\/\s*1M/
    )
    expect(screen.getByText('Cache Read').parentElement).toHaveTextContent(
      /\$0.003\s*\/\s*1M/
    )
  })

  it('shows the cache read price once when a plugin provider already lists it as a main price', () => {
    render(
      <ModelCard
        model={pricingModel({
          billing_plugin_variants: [
            {
              plugin_key: 'alpha',
              plugin_name: 'Alpha',
              billing_mode: 'tiered_expr',
              billing_expr: 'tier("base", p * 1 + c * 2 + cr * 0.5)',
              billing_usage_schema: {},
            },
          ],
        })}
        selectedGroup='default'
      />
    )
    expect(screen.getAllByText('Cache Read')).toHaveLength(1)
  })

  it('shows the cache read price of an expression model that prices nothing else', () => {
    render(
      <ModelCard
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", cr * 0.5)',
        })}
        selectedGroup='default'
      />
    )
    expect(screen.getByText('Cache Read').parentElement).toHaveTextContent(
      /\$0.5\s*\/\s*1M/
    )
  })

  it('keeps task price ranges in their actual usage unit', () => {
    render(
      <ModelCard
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr:
            'u("mode") == "pro" ? tier("pro", u("seconds") * 0.8) : tier("std", u("seconds") * 0.4)',
          billing_usage_schema: {
            seconds: { type: 'number', unit: 'second' },
            mode: { enum: ['std', 'pro'] },
          },
        })}
      />
    )
    expect(screen.getByText(/0.4.*0.8/)).toHaveTextContent(/0.4 – \$0.8/)
    expect(screen.getByText(/^\/\s*s$/)).toBeVisible()
    expect(screen.queryByText(/1K|1M/)).not.toBeInTheDocument()
  })

  it('hides a task usage price left at zero while another usage price is set', () => {
    render(
      <ModelCard
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("count") * 0 + u("seconds") * 0.7)',
          billing_usage_schema: {
            count: {
              type: 'number',
              unit: 'count',
              description: { en: 'Per-task price' },
            },
            seconds: {
              type: 'number',
              unit: 'second',
              description: { en: 'Video generation unit price' },
            },
          },
        })}
      />
    )
    expect(screen.getByText('Video generation unit price')).toBeVisible()
    expect(screen.queryByText('Per-task price')).not.toBeInTheDocument()
  })

  it('does not show the tier name of a single-tier task price', () => {
    render(
      <ModelCard
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'tier("base", u("seconds") * 0.4)',
          billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
        })}
      />
    )
    expect(screen.getByText(/^\$0\.4$/)).toBeVisible()
    expect(screen.queryByText('(base)')).not.toBeInTheDocument()
  })

  it('shows the unconfigured usage message without inventing a token price', () => {
    render(
      <ModelCard
        model={pricingModel({
          billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
        })}
      />
    )
    expect(
      screen.getByText('Usage-based billing · price not configured')
    ).toBeVisible()
    expect(screen.queryByText('Input')).not.toBeInTheDocument()
  })

  it('shows a spaced task token range with its unit when an example price is present', () => {
    render(
      <ModelCard
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr:
            'u("mode") == "pro" ? tier("pro", u("tokens") * 70 / 1000000) : tier("std", u("tokens") * 42 / 1000000)',
          billing_usage_schema: {
            tokens: { type: 'number', unit: 'token' },
            mode: { enum: ['std', 'pro'] },
          },
          billing_usage_examples: [
            { label: '480p · 5s', facts: { tokens: 48000, mode: 'std' } },
          ],
        })}
      />
    )
    expect(screen.getByText('$42 – $70').parentElement).toHaveTextContent(
      '$42 – $70/1M token'
    )
    expect(screen.getByText(/480p · 5s ≈/)).toBeVisible()
  })

  it('keeps an unrecognized expression visible with the special billing message', () => {
    const expression =
      'u("seconds") > 30 ? tier("long", u("seconds") * 0.3) : tier("short", u("seconds") * 0.4)'
    render(
      <ModelCard
        model={pricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: expression,
          billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
        })}
      />
    )
    expect(screen.getByText('Special billing expression')).toBeVisible()
    expect(screen.getByText(expression)).toBeVisible()
  })

  it('shows server history for idle models on the same hourly strip', async () => {
    const request = vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          window_end: 9000,
          models: [
            {
              model_name: 'active-model',
              avg_latency_ms: 1200,
              avg_tps: 42,
              success_rate: 99.8,
              recent_success_series: [{ ts: 7200, success_rate: 0 }],
            },
          ],
          recent_success_series: {
            'active-model': [{ ts: 3600, success_rate: 100 }],
            'idle-model': [
              { ts: 3600, success_rate: 0 },
              { ts: 7200, success_rate: 100 },
            ],
          },
        },
      },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <ModelCardGrid
          models={[
            pricingModel({ model_name: 'active-model' }),
            pricingModel({ id: 2, model_name: 'idle-model' }),
          ]}
        />
      </QueryClientProvider>
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('img', { name: 'Status, last 24 hours' })
      ).toHaveLength(2)
    )
    expect(request).toHaveBeenCalledWith('/api/perf-metrics/summary', {
      params: { hours: 24, recent_model: ['active-model', 'idle-model'] },
      paramsSerializer: { indexes: null },
    })
    const [active, idle] = screen.getAllByRole('img', {
      name: 'Status, last 24 hours',
    })
    expect(active.children[22]).toHaveClass('bg-emerald-500')
    expect(active.children[23]).toHaveClass('bg-muted-foreground/15')
    expect(idle.children[22]).toHaveClass('bg-red-500')
    expect(idle.children[23]).toHaveClass('bg-emerald-500')
    expect(screen.queryByText('99.80%')).not.toBeInTheDocument()
  })

  it('keeps browsing available after the metrics request fails', async () => {
    const request = vi
      .spyOn(api, 'get')
      .mockRejectedValue(new Error('metrics unavailable'))
    render(
      <QueryClientProvider client={queryClient}>
        <ModelCardGrid models={[pricingModel()]} />
      </QueryClientProvider>
    )
    await waitFor(() =>
      expect(
        queryClient.getQueryState([
          'perf-metrics-summary',
          24,
          ['example-model'],
        ])?.status
      ).toBe('error')
    )
    expect(request).toHaveBeenCalledWith('/api/perf-metrics/summary', {
      params: { hours: 24, recent_model: ['example-model'] },
      paramsSerializer: { indexes: null },
    })
    expect(
      screen.getByRole('img', { name: 'No requests in the last 24 hours' })
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'example-model' })).toHaveAttribute(
      'href',
      '/pricing/example-model'
    )
  })

  it('paginates the model cards and disables navigation at both boundaries', async () => {
    const request = vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: { models: [] } },
    })
    const models = Array.from({ length: 21 }, (_, index) =>
      pricingModel({ id: index + 1, model_name: `model-${index + 1}` })
    )
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <ModelCardGrid models={models} />
      </QueryClientProvider>
    )
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(20)
    expect(request).toHaveBeenCalledWith('/api/perf-metrics/summary', {
      params: {
        hours: 24,
        recent_model: models.slice(0, 20).map((model) => model.model_name),
      },
      paramsSerializer: { indexes: null },
    })
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'model-21' })).toBeVisible()
    expect(request).toHaveBeenLastCalledWith('/api/perf-metrics/summary', {
      params: { hours: 24, recent_model: ['model-21'] },
      paramsSerializer: { indexes: null },
    })
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByRole('heading', { name: 'model-1' })).toBeVisible()
  })

  it('switches the card grid to three columns at the xl breakpoint instead of 2xl', () => {
    queryClient.setQueryData(['perf-metrics-summary', 24, ['example-model']], {
      success: true,
      data: { models: [] },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <ModelCardGrid models={[pricingModel()]} />
      </QueryClientProvider>
    )
    const grid = screen
      .getByRole('heading', { name: 'example-model' })
      .closest('.grid')
    expect(grid).toHaveClass('xl:grid-cols-3')
    expect(grid).not.toHaveClass('2xl:grid-cols-3')
    expect(grid).not.toHaveClass('min-[1440px]:grid-cols-3')
  })

  it('puts samples into their hour of the last day, oldest first, with empty hours between', () => {
    const end = Date.parse('2026-09-07T12:00:00.000Z') / 1000
    const series = [
      { ts: end, success_rate: 100 },
      { ts: end - 5 * 3600, success_rate: 80 },
      { ts: end - 3 * 3600, success_rate: 0 },
    ]
    const original = structuredClone(series)
    render(
      <ModelCard
        model={pricingModel()}
        perf={{
          avg_latency_ms: 1200,
          avg_tps: 42,
          success_rate: 100,
          window_end: end + 1800,
          recent_success_series: series,
        }}
      />
    )
    const slots = [
      ...screen.getByRole('img', { name: 'Status, last 24 hours' }).children,
    ]
    expect(slots).toHaveLength(24)
    expect(slots[23]).toHaveClass('bg-emerald-500')
    expect(slots[20]).toHaveClass('bg-red-500')
    expect(slots[18]).toHaveClass('bg-amber-500')
    expect(slots[19]).toHaveClass('bg-muted-foreground/15')
    expect(series).toEqual(original)
  })

  it('leaves invalid samples empty and keeps a zero success rate', () => {
    const start = Date.parse('2026-09-07T00:00:00.000Z') / 1000
    render(
      <ModelCard
        model={pricingModel()}
        perf={{
          avg_latency_ms: 1200,
          avg_tps: 42,
          success_rate: 50,
          window_end: start + 23 * 3600,
          recent_success_series: [
            { ts: start, success_rate: 100 },
            { ts: start + 3600, success_rate: Number.NaN },
            { ts: start + 2 * 3600, success_rate: -1 },
            { ts: start + 3 * 3600, success_rate: 101 },
            { ts: start + 4 * 3600, success_rate: Number.POSITIVE_INFINITY },
            { ts: start + 5 * 3600, success_rate: 0 },
            { ts: Number.NaN, success_rate: 100 },
          ],
        }}
      />
    )
    const slots = [
      ...screen.getByRole('img', { name: 'Status, last 24 hours' }).children,
    ]
    expect(slots[0]).toHaveClass('bg-emerald-500')
    for (const slot of slots.slice(1, 5)) {
      expect(slot).toHaveClass('bg-muted-foreground/15')
    }
    expect(slots[5]).toHaveClass('bg-red-500')
  })

  it.each([undefined, [], [{ ts: 3600, success_rate: Number.NaN }]])(
    'shows 24 empty hours when the series has no valid samples: %j',
    (series) => {
      render(
        <ModelCard
          model={pricingModel()}
          perf={{
            avg_latency_ms: 1200,
            avg_tps: 42,
            success_rate: 100,
            recent_success_series: series,
          }}
        />
      )
      const strip = screen.getByRole('img', {
        name: 'No requests in the last 24 hours',
      })
      expect(strip.children).toHaveLength(24)
    }
  )

  it('lines the strip up with the server window when the browser clock is a day ahead', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-08T12:37:00.000Z'))
    const serverEnd = Date.parse('2026-09-07T12:30:00.000Z') / 1000
    const hour = serverEnd - (serverEnd % 3600)
    render(
      <ModelCard
        model={pricingModel()}
        perf={{
          avg_latency_ms: 1200,
          avg_tps: 42,
          success_rate: 80,
          window_end: serverEnd,
          recent_success_series: [{ ts: hour, success_rate: 80 }],
        }}
      />
    )
    const slots = screen.getByRole('img', {
      name: 'Status, last 24 hours',
    }).children
    expect(slots[23]).toHaveClass('bg-amber-500')
    vi.useRealTimers()
  })

  it('ends on the newest sample when the server window is missing', () => {
    render(
      <ModelCard
        model={pricingModel()}
        perf={{
          avg_latency_ms: 1200,
          avg_tps: 42,
          success_rate: 80,
          recent_success_series: [
            { ts: 7200, success_rate: 80 },
            { ts: 3600, success_rate: 100 },
          ],
        }}
      />
    )
    const slots = screen.getByRole('img', {
      name: 'Status, last 24 hours',
    }).children
    expect(slots[23]).toHaveClass('bg-amber-500')
    expect(slots[22]).toHaveClass('bg-emerald-500')
  })
})
