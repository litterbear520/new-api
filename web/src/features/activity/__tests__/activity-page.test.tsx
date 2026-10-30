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
import { cleanup, render, screen, within } from '@testing-library/react'
import i18n from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NO_RULES, type PayRules } from '@/features/bear-wallet/lib/rules'

import {
  ActivityContent,
  type StarterState,
} from '../components/activity-content'
import { buildOffers } from '../lib/offers'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({
    to,
    search,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string
    search?: Record<string, string>
  }) => (
    <a href={search ? `${to}?${new URLSearchParams(search)}` : to} {...rest}>
      {children}
    </a>
  ),
}))

const RULES: PayRules = {
  tiers: [
    { min: 10, rate: 0.03 },
    { min: 500, rate: 0.2 },
  ],
  first: { pay: 6, bonus: 40, days: 30, planId: 3 },
  invite: { inviter: 5, invitee: 5 },
  bonusDays: 90,
  bonusPlanId: 1,
  giftPlanId: 2,
}

function renderPage(
  rules: PayRules,
  starter: StarterState = 'guest',
  price: unknown = 0.1
) {
  const offers = buildOffers({ price, usdRate: 7, rules })
  return render(
    <ActivityContent offers={offers} loading={false} starter={starter} />
  )
}

function offer(title: string): HTMLElement {
  const block = screen
    .getByRole('heading', { level: 3, name: title })
    .closest('article')
  if (!block) throw new Error(`no offer titled ${title}`)
  return block
}

afterEach(cleanup)

describe('activity page', () => {
  it('writes out every offer with its numbers', () => {
    renderPage(RULES)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)

    const rate = offer('Top-up rate')
    expect(within(rate).getByText('¥1 = $10')).toBeInTheDocument()
    expect(
      within(rate).getByText('About 1.4% of the official price')
    ).toBeInTheDocument()

    const starter = offer('Starter pack')
    expect(within(starter).getByText('¥6 → $100')).toBeInTheDocument()
    expect(
      within(starter).getByText(/Bonus valid for 30 days/)
    ).toBeInTheDocument()

    const tiers = offer('Top-up bonus')
    const rows = within(tiers).getAllByRole('row').slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      '¥10$100+$33%',
      '¥500$5,000+$1,00020%',
    ])
    expect(
      within(tiers).getByText(/Bonus valid for 90 days/)
    ).toBeInTheDocument()

    const invite = offer('Invite rewards')
    expect(invite).toHaveTextContent(
      'When a friend signs up with your link, you get $5 and they get $5 extra.'
    )
  })

  it('reads the title as one sentence', () => {
    renderPage(RULES)
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      'All our offers, on one page.'
    )
  })

  it('says a one-day bonus lasts 1 day, not 1 days', () => {
    renderPage({
      ...RULES,
      first: { pay: 6, bonus: 40, days: 1, planId: 3 },
      bonusDays: 1,
    })
    expect(
      within(offer('Starter pack')).getByText(/Bonus valid for 1 day$/)
    ).toBeInTheDocument()
    expect(
      within(offer('Top-up bonus')).getByText(/Bonus valid for 1 day$/)
    ).toBeInTheDocument()
  })

  it('keeps the space between the number and 天 in Chinese', async () => {
    i18n.addResourceBundle('zhCN', 'translation', {
      'Bonus valid for {{duration}}': '赠送部分 {{duration}}内有效',
    })
    await i18n.changeLanguage('zhCN')
    try {
      renderPage(RULES)
      expect(screen.getByText(/赠送部分 30 天内有效/)).toBeInTheDocument()
    } finally {
      i18n.removeResourceBundle('zhCN', 'translation')
      await i18n.changeLanguage('en')
    }
  })

  it('links each offer to where it is taken', () => {
    renderPage(RULES)
    const href = (name: string) =>
      screen.getByRole('link', { name }).getAttribute('href')
    expect(href('See model prices')).toBe('/pricing')
    expect(href('Sign up to claim')).toBe('/sign-up')
    expect(href('Go to top up')).toBe('/wallet?tab=topup')
    expect(href('Invite friends')).toBe('/invite')
  })

  it('sends a signed-in user to the top-up, or says the pack was claimed', () => {
    renderPage(RULES, 'open')
    expect(
      screen.getByRole('link', { name: 'Claim it' }).getAttribute('href')
    ).toBe('/wallet?tab=topup')
    cleanup()

    renderPage(RULES, 'claimed')
    expect(
      screen.queryByRole('link', { name: /claim/i })
    ).not.toBeInTheDocument()
    expect(screen.getByText('You have claimed it.')).toBeInTheDocument()
  })

  it('shows no block whose rules are missing', () => {
    renderPage(NO_RULES)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(
      screen.queryByRole('heading', { name: 'Starter pack' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Top-up bonus' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Invite rewards' })
    ).not.toBeInTheDocument()
  })

  it('says so when nothing is running', () => {
    renderPage(NO_RULES, 'guest', 7)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByText('No offers right now.')).toBeInTheDocument()
  })

  it('names only the side of an invite that gets something', () => {
    renderPage({ ...RULES, invite: { inviter: 5, invitee: 0 } })
    const invite = offer('Invite rewards')
    expect(invite).toHaveTextContent(
      'When a friend signs up with your link, you get $5.'
    )
    expect(within(invite).getByText('You get')).toBeInTheDocument()
    expect(
      within(invite).queryByText('Your friend gets')
    ).not.toBeInTheDocument()
  })
})
