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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  PricingFilterBar,
  type PricingFilterBarProps,
} from '../components/pricing-filter-bar'
import type { PricingModel } from '../types'

function model(overrides: Partial<PricingModel>): PricingModel {
  return {
    id: 1,
    model_name: 'model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    ...overrides,
  }
}

const MODELS = [
  model({ id: 1, model_name: 'a-1', vendor_name: 'Vendor A' }),
  model({ id: 2, model_name: 'a-2', vendor_name: 'Vendor A' }),
  model({ id: 3, model_name: 'b-1', vendor_name: 'Vendor B' }),
]

function barProps(
  overrides: Partial<PricingFilterBarProps> = {}
): PricingFilterBarProps {
  return {
    models: MODELS,
    vendors: [
      { id: 1, name: 'Vendor A' },
      { id: 2, name: 'Vendor B' },
      { id: 3, name: 'Vendor C' },
    ],
    search: '',
    onSearchChange: vi.fn(),
    onSearchClear: vi.fn(),
    vendor: 'all',
    onVendorChange: vi.fn(),
    groups: ['default'],
    groupRatios: { default: 1, premium: 3 },
    group: 'all',
    onGroupChange: vi.fn(),
    sortBy: 'name',
    onSortChange: vi.fn(),
    tag: 'all',
    onTagChange: vi.fn(),
    quotaType: 'all',
    onQuotaTypeChange: vi.fn(),
    ...overrides,
  }
}

describe('pricing filter bar', () => {
  it('lists providers with models, most models first, and counts them', () => {
    render(<PricingFilterBar {...barProps()} />)
    const providers = screen.getByRole('group', { name: 'Provider' })
    expect(
      [...providers.querySelectorAll('button')].map((b) => b.textContent)
    ).toEqual(['All3', 'Vendor A2', 'Vendor B1'])
  })

  it('exposes the picked provider as pressed and reports a new pick', async () => {
    const props = barProps()
    const user = userEvent.setup()
    const { rerender } = render(<PricingFilterBar {...props} />)
    expect(screen.getByRole('button', { name: /^All\s*3$/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await user.click(screen.getByRole('button', { name: /^Vendor B\s*1$/ }))
    expect(props.onVendorChange).toHaveBeenCalledWith('Vendor B')

    rerender(<PricingFilterBar {...props} vendor='Vendor B' />)
    expect(
      screen.getByRole('button', { name: /^Vendor B\s*1$/ })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^All\s*3$/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('keeps the picked provider when it is pressed again', async () => {
    const props = barProps({ vendor: 'Vendor A' })
    const user = userEvent.setup()
    render(<PricingFilterBar {...props} />)
    await user.click(screen.getByRole('button', { name: /^Vendor A\s*2$/ }))
    expect(props.onVendorChange).not.toHaveBeenCalled()
  })

  it('moves between providers with the arrow keys and picks one with Enter', async () => {
    const props = barProps()
    const user = userEvent.setup()
    render(<PricingFilterBar {...props} />)
    screen.getByRole('button', { name: /^All\s*3$/ }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: /^Vendor A\s*2$/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(props.onVendorChange).toHaveBeenCalledWith('Vendor A')
  })

  it('puts the providers on their own full-width row below sm, so the strip has room to scroll', () => {
    render(<PricingFilterBar {...barProps()} />)
    const providers = screen.getByRole('group', { name: 'Provider' })
    expect(providers).toHaveClass('basis-full', 'sm:basis-auto')
    expect(providers.parentElement).toHaveClass('flex-wrap', 'sm:flex-nowrap')
  })

  it('reports what the user types and clears the search', async () => {
    const props = barProps({ search: 'gpt' })
    const user = userEvent.setup()
    render(<PricingFilterBar {...props} />)
    await user.type(screen.getByRole('textbox', { name: 'Search models' }), '5')
    expect(props.onSearchChange).toHaveBeenLastCalledWith('gpt5')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(props.onSearchClear).toHaveBeenCalledOnce()
  })

  it('shows the current sort as checked and reports another pick', async () => {
    const props = barProps()
    const user = userEvent.setup()
    render(<PricingFilterBar {...props} />)
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(
      await screen.findByRole('menuitemradio', { name: 'Name' })
    ).toHaveAttribute('aria-checked', 'true')
    const pick = screen.getByRole('menuitemradio', {
      name: 'Input Price: Low to High',
    })
    expect(pick).toHaveAttribute('aria-checked', 'false')
    await user.click(pick)
    expect(props.onSortChange).toHaveBeenCalledWith('input-price-low')
  })

  it('offers per-request sorting only when some model is priced per request', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<PricingFilterBar {...barProps()} />)
    await user.click(screen.getByRole('button', { name: 'Name' }))
    await screen.findByRole('menuitemradio', { name: 'Name' })
    expect(
      screen.queryByRole('menuitemradio', { name: /Per-request Price/ })
    ).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    rerender(
      <PricingFilterBar
        {...barProps({ models: [...MODELS, model({ id: 4, quota_type: 1 })] })}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(
      await screen.findAllByRole('menuitemradio', { name: /Per-request Price/ })
    ).toHaveLength(2)
  })

  it('shows the group menu only when the viewer has more than one group', async () => {
    const props = barProps({ groups: ['default', 'premium'] })
    const user = userEvent.setup()
    const { rerender } = render(<PricingFilterBar {...barProps()} />)
    expect(
      screen.queryByRole('button', { name: 'All Groups' })
    ).not.toBeInTheDocument()

    rerender(<PricingFilterBar {...props} />)
    await user.click(screen.getByRole('button', { name: 'All Groups' }))
    expect(
      await screen.findByRole('menuitemradio', { name: 'All Groups' })
    ).toHaveAttribute('aria-checked', 'true')
    await user.click(
      screen.getByRole('menuitemradio', { name: /^premium\s*×3$/ })
    )
    expect(props.onGroupChange).toHaveBeenCalledWith('premium')
  })

  it('names the picked group with its ratio and checks it in the menu', async () => {
    const user = userEvent.setup()
    render(
      <PricingFilterBar
        {...barProps({ groups: ['default', 'premium'], group: 'premium' })}
      />
    )
    await user.click(screen.getByRole('button', { name: 'premium ×3' }))
    expect(
      await screen.findByRole('menuitemradio', { name: /^premium\s*×3$/ })
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('shows the tag menu only when some model has tags, with a model count per tag', async () => {
    const tagged = [
      model({ id: 1, model_name: 'a', tags: 'Chat, vision' }),
      model({ id: 2, model_name: 'b', tags: 'chat' }),
      model({ id: 3, model_name: 'c' }),
    ]
    const props = barProps({ models: tagged })
    const user = userEvent.setup()
    const { rerender } = render(<PricingFilterBar {...barProps()} />)
    expect(
      screen.queryByRole('button', { name: 'All Tags' })
    ).not.toBeInTheDocument()

    rerender(<PricingFilterBar {...props} />)
    await user.click(screen.getByRole('button', { name: 'All Tags' }))
    expect(
      (await screen.findAllByRole('menuitemradio')).map((i) => i.textContent)
    ).toEqual(['All Tags3', 'chat2', 'vision1'])
    expect(
      screen.getByRole('menuitemradio', { name: /^All Tags/ })
    ).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('menuitemradio', { name: /^chat/ }))
    expect(props.onTagChange).toHaveBeenCalledWith('chat')
  })

  it('names the picked tag and checks it in the menu', async () => {
    const user = userEvent.setup()
    render(
      <PricingFilterBar
        {...barProps({
          models: [model({ id: 1, tags: 'chat' })],
          tag: 'chat',
        })}
      />
    )
    await user.click(screen.getByRole('button', { name: 'chat' }))
    expect(
      await screen.findByRole('menuitemradio', { name: /^chat/ })
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('offers the billing types the models use, with counts, and reports a pick', async () => {
    const props = barProps({
      models: [
        ...MODELS,
        model({ id: 4, model_name: 'per-call', quota_type: 1 }),
      ],
    })
    const user = userEvent.setup()
    render(<PricingFilterBar {...props} />)
    await user.click(screen.getByRole('button', { name: 'All Types' }))
    expect(
      (await screen.findAllByRole('menuitemradio')).map((i) => i.textContent)
    ).toEqual(['All Types4', 'Token-based3', 'Per Request1'])
    await user.click(
      screen.getByRole('menuitemradio', { name: /^Per Request/ })
    )
    expect(props.onQuotaTypeChange).toHaveBeenCalledWith('request')
  })

  it('leaves the billing type menu out when every model bills the same way', () => {
    render(<PricingFilterBar {...barProps()} />)
    expect(
      screen.queryByRole('button', { name: 'All Types' })
    ).not.toBeInTheDocument()
  })

  it('keeps a billing type picked from the URL visible so it can be cleared', async () => {
    const props = barProps({ quotaType: 'request' })
    const user = userEvent.setup()
    render(<PricingFilterBar {...props} />)
    await user.click(screen.getByRole('button', { name: 'Per Request' }))
    await user.click(
      await screen.findByRole('menuitemradio', { name: /^All Types/ })
    )
    expect(props.onQuotaTypeChange).toHaveBeenCalledWith('all')
  })

  it('lets the menus wrap under the providers below sm instead of overflowing', () => {
    render(<PricingFilterBar {...barProps()} />)
    const menus = screen.getByRole('button', { name: 'Name' }).parentElement
    expect(menus).toHaveClass('flex-wrap', 'sm:flex-nowrap', 'sm:shrink-0')
  })
})
