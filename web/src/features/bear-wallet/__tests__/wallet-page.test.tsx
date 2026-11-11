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
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { BearWallet, type BearWalletProps } from '..'

const DOLLAR = 500000
const DAY = 86400
let client: QueryClient
let self: AuthUser
let subscriptions: Array<Record<string, unknown>>
let topups: Array<Record<string, unknown>>
let rulesOk: boolean
let plans: Array<Record<string, unknown>>
let topupInfo: Record<string, unknown>
let status: Record<string, unknown>
let historyFails: boolean
/** What New API answers POST /api/user/amount with */
let payMoney: (amount: number) => Promise<Record<string, unknown>>

const nowSec = () => Math.floor(Date.now() / 1000)

const RULES = {
  tiers: [
    { min: 10, rate: 0.03 },
    { min: 20, rate: 0.05 },
    { min: 50, rate: 0.08 },
    { min: 100, rate: 0.1 },
    { min: 300, rate: 0.15 },
    { min: 500, rate: 0.2 },
  ],
  bonus_days: 90,
  bonus_plan_id: 3,
  gift_plan_id: 4,
  first: null as null | Record<string, number>,
}

const PAID = {
  id: 1,
  user_id: 7,
  amount: 100,
  money: 10,
  trade_no: 'USR7NOold',
  payment_method: 'alipay',
  create_time: 1_790_000_000,
  complete_time: 1_790_000_030,
  status: 'success',
}

const GIFT = {
  id: 4,
  title: '新人礼包',
  price_amount: 9.9,
  currency: 'USD',
  duration_unit: 'day',
  duration_value: 30,
  quota_reset_period: 'never',
  enabled: true,
  sort_order: 0,
  max_purchase_per_user: 1,
  total_amount: 200 * DOLLAR,
}

function sub(over: Record<string, unknown>) {
  return {
    id: 1,
    user_id: 7,
    plan_id: 3,
    status: 'active',
    source: 'admin',
    start_time: nowSec() - DAY,
    end_time: nowSec() + 30 * DAY,
    amount_total: 50 * DOLLAR,
    amount_used: 0,
    ...over,
  }
}

const ok = (data: unknown) => ({ data: { success: true, data } })

beforeEach(() => {
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  subscriptions = []
  topups = [PAID]
  rulesOk = true
  plans = [{ plan: GIFT }]
  RULES.first = null
  historyFails = false
  status = { price: 0.1 }
  topupInfo = {
    enable_online_topup: true,
    enable_stripe_topup: false,
    pay_methods: [
      { name: '支付宝', type: 'alipay', icon: 'SiAlipay' },
      { name: '微信', type: 'wxpay', icon: 'SiWechat' },
    ],
    min_topup: 1,
    stripe_min_topup: 0,
    amount_options: [],
    discount: {},
  }
  payMoney = async (amount) => ({
    message: 'success',
    data: (amount * 0.1).toFixed(2),
  })
  vi.spyOn(api, 'post').mockImplementation(async (url: string, body) => {
    const amount = Number((body as { amount: number }).amount)
    if (url === '/api/user/amount') return { data: await payMoney(amount) }
    if (url === '/api/user/pay') {
      return { data: { message: 'error', data: 'cashier offline' } }
    }
    throw new Error(`Unexpected wallet request: POST ${url}`)
  })
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (String(input) === '/pay/rules' && rulesOk) {
      return new Response(JSON.stringify(RULES), { status: 200 })
    }
    throw new Error('offline')
  })
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/api/user/self') return ok(self)
    if (url === '/api/status') return ok(status)
    if (url === '/api/data/self' || url.startsWith('/api/data/self?')) {
      return ok([])
    }
    if (url === '/api/user/topup/info') return ok(topupInfo)
    if (url === '/api/subscription/self') {
      return ok({
        billing_preference: 'subscription_first',
        subscriptions: [],
        all_subscriptions: subscriptions.map((item) => ({
          subscription: item,
        })),
      })
    }
    if (url === '/api/subscription/plans') return ok(plans)
    if (url.startsWith('/api/user/topup/self?')) {
      if (historyFails) return { data: { success: false, message: 'busy' } }
      // Paged like New API: page_size is capped at 100.
      const query = new URL(url, 'http://localhost').searchParams
      const size = Math.min(Number(query.get('page_size')) || 10, 100)
      const page = Math.max(1, Number(query.get('p')) || 1)
      return ok({
        items: topups.slice((page - 1) * size, page * size),
        total: topups.length,
      })
    }
    throw new Error(`Unexpected wallet request: ${url}`)
  })
})

afterEach(async () => {
  await i18next.changeLanguage('en')
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
})

async function renderWallet(user: AuthUser, props: BearWalletProps = {}) {
  self = user
  useAuthStore.getState().auth.setUser(user)
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <BearWallet {...props} /> }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const returning: AuthUser = {
  id: 7,
  username: 'bear',
  display_name: '小熊',
  role: 1,
  github_id: '123',
  quota: 216.44 * DOLLAR,
  used_quota: 40 * DOLLAR,
  request_count: 120,
}

/** Text that Trans splits across <b> tags, matched on the whole line */
function line(className: string, text: string) {
  return screen.findByText(
    (_, element) =>
      Boolean(element?.classList.contains(className)) &&
      element?.textContent === text
  )
}

describe('wallet', () => {
  it('shows the balance, the deals and the history, without tabs', async () => {
    RULES.first = { pay: 6, bonus: 40, days: 30, plan_id: 5 }
    subscriptions = [sub({})]
    await renderWallet(returning)

    const figures = screen.getByRole('region', { name: 'Wallet' })
    expect(await within(figures).findByText('$266.44')).toBeInTheDocument()
    expect(
      within(figures).getByText('Includes $50 with an expiry date')
    ).toBeInTheDocument()
    expect(await within(figures).findByText('¥10')).toBeInTheDocument()
    expect(within(figures).getByText('Paid top-ups: 1')).toBeInTheDocument()
    // New API only returns the last 30 days of orders
    expect(
      within(figures).getByText('Topped up, last 30 days')
    ).toBeInTheDocument()

    const deals = await screen.findByRole('button', { name: /^Starter pack/ })
    expect(deals).toHaveTextContent(
      'Starter pack: pay ¥6, get $100, once per account'
    )
    expect(deals).toHaveTextContent('Single payments from ¥10 get 3–20% bonus')

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    const history = screen.getByRole('region', { name: 'Top-up history' })
    expect(await within(history).findByText('USR7NOold')).toBeInTheDocument()
    expect(within(history).getByText('+$100')).toBeInTheDocument()
    expect(within(history).getByText('Credited')).toBeInTheDocument()
    expect(within(history).getByText('Top-up bonus')).toBeInTheDocument()

    // the deals line opens the top-up dialog
    fireEvent.click(deals)
    expect(
      await screen.findByRole('dialog', { name: 'Top up' })
    ).toBeInTheDocument()
  })

  it('tops up in a dialog: ¥100 with its bonus by default', async () => {
    subscriptions = [sub({})]
    await renderWallet(returning)
    fireEvent.click(await screen.findByRole('button', { name: 'Top up' }))
    const dialog = await screen.findByRole('dialog', { name: 'Top up' })

    expect(dialog).toHaveTextContent(
      '¥1 = $10. Single payments from ¥10 get up to 20% bonus.'
    )
    const chip = await within(dialog).findByRole('radio', {
      name: '¥100+10%',
    })
    expect(chip).toHaveAttribute('aria-checked', 'true')
    expect(
      await line('bw-res', 'You get $1,000 + $100 bonus')
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/^Bonus credit lasts 90 days/)
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Continue to pay ¥100' })
    ).toBeEnabled()
    expect(
      within(dialog).getByText(
        'Credited to this account: 小熊 (signed in with GitHub)'
      )
    ).toBeInTheDocument()
  })

  it('works out custom amounts by the same tiers', async () => {
    await renderWallet(returning, { initialTab: 'topup' })
    const input = await screen.findByRole('textbox', {
      name: 'Custom amount in yuan',
    })
    fireEvent.change(input, { target: { value: '150' } })
    expect(
      await line('bw-res', 'You get $1,500 + $150 bonus')
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '¥100+10%' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
    fireEvent.change(input, { target: { value: '0' } })
    expect(
      screen.getByText('Enter a whole number from 1 to 10000')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue to pay' })
    ).toBeDisabled()
    // picking a button again empties the field
    fireEvent.click(screen.getByRole('radio', { name: '¥50+8%' }))
    expect(input).toHaveValue('')
    expect(await line('bw-res', 'You get $500 + $40 bonus')).toBeInTheDocument()
  })

  it('opens on the amount picked on the overview', async () => {
    await renderWallet(returning, { initialAmount: 300 })
    expect(
      await screen.findByRole('textbox', { name: 'Custom amount in yuan' })
    ).toHaveValue('30')
    expect(await line('bw-res', 'You get $300 + $15 bonus')).toBeInTheDocument()
  })

  it('preselects the gift pack for a new account', async () => {
    await renderWallet(
      {
        ...returning,
        quota: 5 * DOLLAR,
        used_quota: 0,
        request_count: 0,
      },
      { initialTab: 'topup' }
    )
    const gift = await screen.findByRole('radio', { name: '新人礼包 ¥9.9' })
    expect(gift).toHaveAttribute('aria-checked', 'true')
    expect(
      await line('bw-res', 'You get $200, valid for 30 days')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue to pay ¥9.9' })
    ).toBeEnabled()
  })

  it('offers the starter pack once per account, top-ups before or not', async () => {
    RULES.first = { pay: 6, bonus: 40, days: 30, plan_id: 5 }
    plans = []
    await renderWallet(returning, { initialTab: 'topup' })
    const card = await screen.findByRole('radio', { name: /^Starter pack/ })
    expect(card).toHaveAttribute('aria-checked', 'true')
    expect(card).toHaveTextContent('Once per account')
    expect(card).toHaveTextContent('You get $100 (incl. $40 bonus)')
    expect(card).toHaveTextContent(/¥6\s*Usual price ¥10/)
    expect(
      await line('bw-res', 'You get $60 + $40 bonus, valid for 30 days')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue to pay ¥6' })
    ).toBeEnabled()
    // the amount buttons show their tier only
    expect(screen.getByRole('radio', { name: '¥10+3%' })).toBeInTheDocument()
  })

  it('does not offer the starter pack once the user has had it', async () => {
    RULES.first = { pay: 6, bonus: 40, days: 30, plan_id: 5 }
    subscriptions = [sub({ plan_id: 5, status: 'expired' })]
    await renderWallet(returning, { initialTab: 'topup' })
    expect(
      await screen.findByRole('radio', { name: '¥10+3%' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('radio', { name: /^Starter pack/ })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/^Starter pack:/)).not.toBeInTheDocument()
  })

  it('promises no bonus when the rules cannot be read', async () => {
    rulesOk = false
    await renderWallet(returning, { initialTab: 'topup' })
    expect(
      await screen.findByRole('radio', { name: '¥100' })
    ).toBeInTheDocument()
    expect(await line('bw-res', 'You get $1,000')).toBeInTheDocument()
    expect(screen.getByText('Exchange rate: ¥1 = $10')).toBeInTheDocument()
    expect(screen.queryByText(/Single payments from/)).not.toBeInTheDocument()
  })

  it('opens the redemption code dialog from older ?tab=code links', async () => {
    await renderWallet(returning, { initialTab: 'code' })
    const dialog = await screen.findByRole('dialog', {
      name: 'Redemption code',
    })
    expect(
      within(dialog).getByRole('button', { name: 'Redeem' })
    ).toBeDisabled()
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: 'ABC-123' },
    })
    expect(within(dialog).getByRole('button', { name: 'Redeem' })).toBeEnabled()
  })

  it('says what arrived when pay-bridge sends the payer back', async () => {
    const done = nowSec() - 30
    topups = [
      {
        id: 9,
        user_id: 7,
        amount: 1000,
        money: 100,
        trade_no: 'USR7NOabc123',
        payment_method: 'alipay',
        create_time: done - 60,
        complete_time: done,
        status: 'success',
      },
    ]
    subscriptions = [sub({ start_time: done + 1, amount_total: 100 * DOLLAR })]
    await renderWallet(returning, { paid: 'USR7NOabc123' })
    expect(
      await line('bw-paid', 'Payment received: $1,000 added, plus $100 bonus')
    ).toBeInTheDocument()
  })

  it('does not count an earlier order’s bonus as this one’s', async () => {
    RULES.first = { pay: 6, bonus: 40, days: 30, plan_id: 5 }
    const done = nowSec() - 30
    topups = [
      {
        ...PAID,
        id: 9,
        amount: 100,
        money: 10,
        trade_no: 'USR7NOsecond',
        create_time: done - 20,
        complete_time: done,
      },
    ]
    // the starter pack bought a minute before
    subscriptions = [
      sub({
        id: 2,
        plan_id: 5,
        start_time: done - 60,
        amount_total: 40 * DOLLAR,
      }),
    ]
    await renderWallet(returning, { paid: 'USR7NOsecond' })
    expect(
      await line('bw-paid', 'Payment received: $100 added')
    ).toBeInTheDocument()

    // this order's own 3% bonus, granted after it was credited
    subscriptions = [
      ...subscriptions,
      sub({
        id: 3,
        plan_id: 3,
        start_time: done + 2,
        amount_total: 3 * DOLLAR,
      }),
    ]
    await act(() =>
      client.invalidateQueries({ queryKey: ['bear-wallet', 'subscriptions'] })
    )
    expect(
      await line('bw-paid', 'Payment received: $100 added, plus $3 bonus')
    ).toBeInTheDocument()
  })

  it('names the starter pack’s bonus on the starter top-up', async () => {
    RULES.first = { pay: 6, bonus: 40, days: 30, plan_id: 5 }
    const done = nowSec() - 30
    topups = [
      {
        ...PAID,
        id: 9,
        amount: 60,
        money: 6,
        trade_no: 'USR7NOstarter',
        create_time: done - 20,
        complete_time: done,
      },
    ]
    subscriptions = [
      sub({
        id: 2,
        plan_id: 5,
        start_time: done + 1,
        amount_total: 40 * DOLLAR,
      }),
    ]
    await renderWallet(returning, { paid: 'USR7NOstarter' })
    expect(
      await line('bw-paid', 'Payment received: $60 added, plus $40 bonus')
    ).toBeInTheDocument()
  })

  it('says the gift pack arrived only once the wallet holds it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await renderWallet(returning, { paid: 'SUBUSR7NOnotpaid' })
      expect(
        await screen.findByText('Confirming your payment…')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('Payment received. The gift pack is in your wallet.')
      ).not.toBeInTheDocument()
      await vi.advanceTimersByTimeAsync(3000 * 25)
      expect(
        await screen.findByText(
          'The payment is not confirmed yet. Refresh this page in a few minutes.'
        )
      ).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('says the gift pack arrived when the wallet holds it', async () => {
    subscriptions = [sub({ plan_id: 4, amount_total: 200 * DOLLAR })]
    await renderWallet(returning, { paid: 'SUBUSR7NOgift' })
    expect(
      await screen.findByText(
        'Payment received. The gift pack is in your wallet.'
      )
    ).toBeInTheDocument()
  })

  it('pages through more than 100 orders', async () => {
    topups = Array.from({ length: 101 }, (_, i) => ({
      ...PAID,
      id: i + 1,
      trade_no: `USR7NOrow-${i + 1}`,
      create_time: PAID.create_time - i,
    }))
    await renderWallet(returning)
    const history = screen.getByRole('region', { name: 'Top-up history' })
    for (let shown = 20; shown <= 100; shown += 20) {
      expect(
        await within(history).findByText(`USR7NOrow-${shown}`)
      ).toBeInTheDocument()
      const more = within(history).getByRole('button', { name: 'Show more' })
      await waitFor(() => expect(more).toBeEnabled())
      fireEvent.click(more)
    }
    expect(
      await within(history).findByText('USR7NOrow-101')
    ).toBeInTheDocument()
    expect(
      within(history).queryByRole('button', { name: 'Show more' })
    ).not.toBeInTheDocument()
  })

  it('truncates a long order number inside its cell', async () => {
    const trade = `USR7NO${'x'.repeat(60)}`
    topups = [{ ...PAID, trade_no: trade }]
    await renderWallet(returning)
    const history = screen.getByRole('region', { name: 'Top-up history' })
    const order = await within(history).findByText(trade)
    // Auto table layout ignores max-width on a cell, so the limit sits on the
    // element that truncates.
    expect(order).toHaveClass('max-w-56')
    expect(order.closest('td')).not.toHaveClass('max-w-56')
  })

  it('moves between amounts with the arrow keys, one Tab stop per group', async () => {
    const user = userEvent.setup()
    subscriptions = [sub({})]
    await renderWallet(returning, { initialTab: 'topup' })
    const picked = await screen.findByRole('radio', { name: '¥100+10%' })
    const amounts = screen.getByRole('radiogroup', { name: 'Payment amount' })
    expect(
      within(amounts)
        .getAllByRole('radio')
        .filter((radio) => radio.tabIndex === 0)
    ).toEqual([picked])

    picked.focus()
    await user.keyboard('{ArrowRight}')
    const next = screen.getByRole('radio', { name: '¥300+15%' })
    await waitFor(() => expect(next).toHaveAttribute('aria-checked', 'true'))
    expect(next).toHaveFocus()
    expect(picked).toHaveAttribute('aria-checked', 'false')
    expect(
      await line('bw-res', 'You get $3,000 + $450 bonus')
    ).toBeInTheDocument()
  })

  it('moves between payment methods with the arrow keys', async () => {
    const user = userEvent.setup()
    await renderWallet(returning, { initialTab: 'topup' })
    const methods = await screen.findByRole('radiogroup', {
      name: 'Payment method',
    })
    const alipay = within(methods).getByRole('radio', { name: '支付宝' })
    expect(alipay).toHaveAttribute('aria-checked', 'true')
    expect(
      within(methods).getByRole('radio', { name: '微信' })
    ).toHaveAttribute('tabindex', '-1')

    alipay.focus()
    await user.keyboard('{ArrowRight}')
    const wechat = within(methods).getByRole('radio', { name: '微信' })
    await waitFor(() => expect(wechat).toHaveAttribute('aria-checked', 'true'))
    expect(wechat).toHaveFocus()
  })

  it('starts from the default amount each time the dialog opens', async () => {
    subscriptions = [sub({})]
    await renderWallet(returning)
    fireEvent.click(await screen.findByRole('button', { name: 'Top up' }))
    fireEvent.click(await screen.findByRole('radio', { name: '¥50+8%' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: 'Top up' }))
    expect(
      await screen.findByRole('radio', { name: '¥100+10%' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '¥50+8%' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('formats the exchange rate in the interface language', async () => {
    await i18next.changeLanguage('fr')
    await renderWallet(returning, { initialTab: 'topup' })
    const dialog = await screen.findByRole('dialog', { name: 'Top up' })
    expect(dialog).toHaveTextContent(/1\s¥ = 10\s\$/)
  })
  it('charges what New API quotes, and matches the tier to that sum', async () => {
    // A top-up group ratio of 0.8: ¥100 of credit costs ¥80
    payMoney = async (amount) => ({
      message: 'success',
      data: (amount * 0.08).toFixed(2),
    })
    await renderWallet(returning, { initialTab: 'topup' })
    const dialog = await screen.findByRole('dialog', { name: 'Top up' })
    expect(
      await within(dialog).findByRole('button', {
        name: 'Continue to pay ¥80',
      })
    ).toBeEnabled()
    // ¥80 reaches the ¥50 tier (8%), not the ¥100 one
    expect(
      await line('bw-res', 'You get $1,000 + $80 bonus')
    ).toBeInTheDocument()
    // The button shows what is charged, and so does the rate
    expect(
      within(dialog).getByRole('radio', { name: '¥80+8%' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(dialog).toHaveTextContent(/^Top up¥1 = \$12\.5\. /)
    expect(api.post).toHaveBeenCalledWith(
      '/api/user/amount',
      { amount: 1000 },
      expect.anything()
    )
  })

  it('leaves the rate out when New API discounts amounts unevenly', async () => {
    payMoney = async (amount) => ({
      message: 'success',
      data: (amount === 1000 ? 90 : amount * 0.1).toFixed(2),
    })
    await renderWallet(returning, { initialTab: 'topup' })
    const dialog = await screen.findByRole('dialog', { name: 'Top up' })
    expect(
      await within(dialog).findByRole('radio', { name: '¥90+8%' })
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Single payments from ¥10 get up to 20% bonus.')
    ).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent('¥1 =')
  })

  it('shows the starter pack only once New API charges its price', async () => {
    RULES.first = { pay: 6, bonus: 40, days: 30, plan_id: 5 }
    plans = []
    const waiting: Array<() => void> = []
    payMoney = (amount) =>
      new Promise((resolve) => {
        waiting.push(() =>
          resolve({ message: 'success', data: (amount * 0.08).toFixed(2) })
        )
      })
    await renderWallet(returning, { initialTab: 'topup' })
    const dialog = await screen.findByRole('dialog', { name: 'Top up' })
    await waitFor(() => expect(waiting.length).toBeGreaterThan(0))
    // Nothing to pick until the prices are in, so nothing jumps
    expect(within(dialog).queryAllByRole('radio')).toHaveLength(0)

    for (const answer of waiting) answer()
    expect(
      await within(dialog).findByRole('radio', { name: '¥80+8%' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(
      within(dialog).queryByRole('radio', { name: /^Starter pack/ })
    ).not.toBeInTheDocument()
  })

  it('holds the pay button until New API has quoted the amount', async () => {
    let answer: () => void = () => undefined
    payMoney = (amount) =>
      new Promise((resolve) => {
        const done = () =>
          resolve({ message: 'success', data: (amount * 0.1).toFixed(2) })
        if (amount === 1500) answer = done
        else done()
      })
    await renderWallet(returning, { initialTab: 'topup' })
    const dialog = await screen.findByRole('dialog', { name: 'Top up' })
    fireEvent.change(
      await within(dialog).findByRole('textbox', {
        name: 'Custom amount in yuan',
      }),
      { target: { value: '150' } }
    )
    const pay = within(dialog).getByRole('button', { name: 'Continue to pay' })
    expect(pay).toBeDisabled()
    expect(pay).toHaveAttribute('aria-busy', 'true')

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/api/user/amount',
        { amount: 1500 },
        expect.anything()
      )
    )
    answer()
    expect(
      await within(dialog).findByRole('button', {
        name: 'Continue to pay ¥150',
      })
    ).toBeEnabled()
  })

  it('says why New API will not take an amount', async () => {
    payMoney = async (amount) =>
      amount === 20
        ? { message: 'error', data: 'Payment amount is too low' }
        : { message: 'success', data: (amount * 0.1).toFixed(2) }
    await renderWallet(returning, { initialTab: 'topup' })
    const input = await screen.findByRole('textbox', {
      name: 'Custom amount in yuan',
    })
    fireEvent.change(input, { target: { value: '2' } })
    expect(
      await screen.findByText('Payment amount is too low')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue to pay' })
    ).toBeDisabled()
    // A refusal is final: asked once, no retry offered
    expect(
      vi
        .mocked(api.post)
        .mock.calls.filter(
          ([url, body]) =>
            url === '/api/user/amount' &&
            (body as { amount: number }).amount === 20
        )
    ).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: 'Retry' })
    ).not.toBeInTheDocument()
  })

  it('translates the refusal in the language shown now', async () => {
    i18next.addResourceBundle('fr', 'translation', {
      'Payment amount is too low': 'Montant trop faible',
    })
    try {
      payMoney = async (amount) =>
        amount === 20
          ? {
              message: 'error',
              data: 'Payment amount is too low',
              message_key: 'Payment amount is too low',
            }
          : { message: 'success', data: (amount * 0.1).toFixed(2) }
      await renderWallet(returning, { initialTab: 'topup' })
      fireEvent.change(
        await screen.findByRole('textbox', { name: 'Custom amount in yuan' }),
        { target: { value: '2' } }
      )
      expect(
        await screen.findByText('Payment amount is too low')
      ).toBeInTheDocument()
      await act(() => i18next.changeLanguage('fr'))
      expect(await screen.findByText('Montant trop faible')).toBeInTheDocument()
    } finally {
      i18next.removeResourceBundle('fr', 'translation')
    }
  })

  it('retries a price that did not load, then offers a retry', async () => {
    // Retry at once instead of backing off for seconds
    client.setDefaultOptions({ queries: { retry: false, retryDelay: 1 } })
    let offline = true
    payMoney = async (amount) => {
      if (offline && amount === 1500) throw new Error('Network Error')
      return { message: 'success', data: (amount * 0.1).toFixed(2) }
    }
    const askedFor1500 = () =>
      vi
        .mocked(api.post)
        .mock.calls.filter(
          ([url, body]) =>
            url === '/api/user/amount' &&
            (body as { amount: number }).amount === 1500
        ).length
    await renderWallet(returning, { initialTab: 'topup' })
    fireEvent.change(
      await screen.findByRole('textbox', { name: 'Custom amount in yuan' }),
      { target: { value: '150' } }
    )
    expect(
      await screen.findByText('Could not get the amount to pay.')
    ).toBeInTheDocument()
    expect(askedFor1500()).toBeGreaterThan(1)
    expect(
      screen.getByRole('button', { name: 'Continue to pay' })
    ).toBeDisabled()

    offline = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByRole('button', { name: 'Continue to pay ¥150' })
    ).toBeEnabled()
  })

  it('says so when the order cannot be checked', async () => {
    historyFails = true
    await renderWallet(returning, { paid: 'USR7NOabc123' })
    expect(
      await screen.findByText(
        'Could not check this payment. Refresh this page in a few minutes.'
      )
    ).toBeInTheDocument()
  })

  it('asks New API in tokens when quota shows as tokens', async () => {
    status = {
      price: 0.1,
      quota_display_type: 'TOKENS',
      quota_per_unit: DOLLAR,
    }
    payMoney = async (amount) => ({
      message: 'success',
      data: ((amount / DOLLAR) * 0.1).toFixed(2),
    })
    await renderWallet(returning, { initialTab: 'topup' })
    const dialog = await screen.findByRole('dialog', { name: 'Top up' })
    expect(
      await within(dialog).findByText(/^¥1 = 5,000,000 tokens\./)
    ).toBeInTheDocument()
    const pay = await within(dialog).findByRole('button', {
      name: 'Continue to pay ¥100',
    })
    expect(api.post).toHaveBeenCalledWith(
      '/api/user/amount',
      { amount: 1000 * DOLLAR },
      expect.anything()
    )
    fireEvent.click(pay)
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/api/user/pay',
        { amount: 1000 * DOLLAR, payment_method: 'alipay' },
        expect.anything()
      )
    )
  })

  it('names the credit apart from the yuan price when quota shows in yuan', async () => {
    status = { price: 0.1, quota_display_type: 'CNY', usd_exchange_rate: 7 }
    await renderWallet(returning, { initialTab: 'topup' })
    const dialog = await screen.findByRole('dialog', { name: 'Top up' })
    expect(
      await within(dialog).findByText(/^¥1 = ¥70 of credit\./)
    ).toBeInTheDocument()
  })

  it('links to where codes are sold when the site sets one', async () => {
    topupInfo = { ...topupInfo, topup_link: 'https://shop.example/codes' }
    await renderWallet(returning, { initialTab: 'code' })
    const dialog = await screen.findByRole('dialog', {
      name: 'Redemption code',
    })
    expect(
      await within(dialog).findByRole('link', { name: /Get one here/ })
    ).toHaveAttribute('href', 'https://shop.example/codes')
  })

  it('offers no shop link when the site sets none', async () => {
    await renderWallet(returning, { initialTab: 'code' })
    const dialog = await screen.findByRole('dialog', {
      name: 'Redemption code',
    })
    expect(within(dialog).queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows a retry, not an empty history, when the orders cannot load', async () => {
    historyFails = true
    await renderWallet(returning)
    const history = screen.getByRole('region', { name: 'Top-up history' })
    expect(
      await within(history).findByText('Failed to load')
    ).toBeInTheDocument()
    expect(
      within(history).queryByText('No top-ups yet.')
    ).not.toBeInTheDocument()
    const figures = screen.getByRole('region', { name: 'Wallet' })
    expect(
      await within(figures).findByRole('button', { name: 'Retry' })
    ).toBeInTheDocument()

    historyFails = false
    fireEvent.click(within(history).getByRole('button', { name: 'Retry' }))
    expect(await within(history).findByText('USR7NOold')).toBeInTheDocument()
  })

  it('stops saying it is confirming once it stops asking', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      topups = [{ ...PAID, trade_no: 'USR7NOwait', status: 'pending' }]
      await renderWallet(returning, { paid: 'USR7NOwait' })
      expect(
        await screen.findByText('Confirming your payment…')
      ).toBeInTheDocument()
      await vi.advanceTimersByTimeAsync(3000 * 25)
      expect(
        await screen.findByText(
          'The payment is not confirmed yet. Refresh this page in a few minutes.'
        )
      ).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([
    ['failed', 'The payment did not go through.'],
    ['expired', 'This order expired before it was paid.'],
  ])('says so when the order has %s', async (status, text) => {
    topups = [{ ...PAID, trade_no: 'USR7NOgone', status }]
    await renderWallet(returning, { paid: 'USR7NOgone' })
    expect(await screen.findByText(text)).toBeInTheDocument()
  })
})
